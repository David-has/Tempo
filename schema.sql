create extension if not exists pgcrypto;

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  referred_by text references waitlist (code),
  created_at timestamptz not null default now()
);

create table if not exists feature_votes (
  code text not null references waitlist (code) on delete cascade,
  feature text not null check (feature in ('calendar', 'offline', 'widget', 'voice', 'teams')),
  created_at timestamptz not null default now(),
  primary key (code, feature)
);

alter table waitlist enable row level security;
alter table feature_votes enable row level security;

create or replace function member_info(p_code text)
returns json
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select
      w.code,
      count(r.id) as referrals,
      row_number() over (order by count(r.id) desc, w.created_at asc) as position
    from waitlist w
    left join waitlist r on r.referred_by = w.code
    group by w.code, w.created_at
  )
  select json_build_object(
    'code', ranked.code,
    'position', ranked.position,
    'referrals', ranked.referrals,
    'total', (select count(*) from waitlist),
    'votes', coalesce(
      (select json_agg(feature) from feature_votes where code = ranked.code),
      '[]'::json
    )
  )
  from ranked
  where ranked.code = p_code;
$$;

create or replace function join_waitlist(p_email text, p_ref text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_ref text := nullif(trim(p_ref), '');
  v_code text;
begin
  if v_ref is not null and not exists (select 1 from waitlist where code = v_ref) then
    v_ref := null;
  end if;

  insert into waitlist (email, referred_by)
  values (v_email, v_ref)
  on conflict (email) do nothing;

  select code into v_code from waitlist where email = v_email;

  return member_info(v_code);
end;
$$;

create or replace function toggle_vote(p_code text, p_feature text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from waitlist where code = p_code) then
    raise exception 'unknown member';
  end if;

  if exists (select 1 from feature_votes where code = p_code and feature = p_feature) then
    delete from feature_votes where code = p_code and feature = p_feature;
  elsif (select count(*) from feature_votes where code = p_code) < 3 then
    insert into feature_votes (code, feature) values (p_code, p_feature);
  end if;

  return member_info(p_code);
end;
$$;

create or replace function get_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total', (select count(*) from waitlist),
    'leaderboard', coalesce(
      (
        select json_agg(row_to_json(top))
        from (
          select
            left(w.email, 1) || '***' || substr(w.email, strpos(w.email, '@')) as name,
            count(r.id) as referrals
          from waitlist w
          left join waitlist r on r.referred_by = w.code
          group by w.id
          order by count(r.id) desc, w.created_at asc
          limit 5
        ) top
      ),
      '[]'::json
    ),
    'votes', coalesce(
      (
        select json_object_agg(feature, total)
        from (
          select feature, count(*) as total
          from feature_votes
          group by feature
        ) counted
      ),
      '{}'::json
    )
  );
$$;

grant execute on function member_info(text) to anon, authenticated;
grant execute on function join_waitlist(text, text) to anon, authenticated;
grant execute on function toggle_vote(text, text) to anon, authenticated;
grant execute on function get_stats() to anon, authenticated;
