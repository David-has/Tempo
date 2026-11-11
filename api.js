const Api = (() => {
  const useRemote = Boolean(Config.supabaseUrl && Config.supabaseKey);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const maskEmail = (email) => `${email[0]}***${email.slice(email.indexOf("@"))}`;

  const createLocalAdapter = () => {
    const STORAGE_KEY = "tempo-db";
    const DOMAINS = ["gmail.com", "yahoo.com", "outlook.com"];
    const LETTERS = "abcdefghijklmnoprstuvz";

    const seedDatabase = () => {
      const now = Date.now();
      const featureIds = Config.features.map((feature) => feature.id);

      const members = Array.from({ length: 41 }, (_, index) => ({
        email: `${LETTERS[(index * 7) % LETTERS.length]}${index}user@${DOMAINS[index % 3]}`,
        code: `seed${String(index).padStart(4, "0")}`,
        refBy: index >= 6 ? `seed${String(index % 6).padStart(4, "0")}` : null,
        createdAt: now - (60 - index) * 36e5,
      }));

      const votes = members.flatMap((member, index) => {
        const picks = [{ code: member.code, feature: featureIds[index % featureIds.length] }];

        if (index % 3 === 0) {
          picks.push({ code: member.code, feature: featureIds[(index + 2) % featureIds.length] });
        }

        return picks;
      });

      return { members, votes };
    };

    const load = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (error) {
        return seedDatabase();
      }

      return seedDatabase();
    };

    const save = (db) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch (error) {
        return;
      }
    };

    const rank = (db) => {
      const counts = {};

      db.members.forEach((member) => {
        if (member.refBy) counts[member.refBy] = (counts[member.refBy] || 0) + 1;
      });

      return db.members
        .map((member) => ({ ...member, referrals: counts[member.code] || 0 }))
        .sort((a, b) => b.referrals - a.referrals || a.createdAt - b.createdAt)
        .map((member, index) => ({ ...member, position: index + 1 }));
    };

    const describe = (db, code) => {
      const member = rank(db).find((item) => item.code === code);
      if (!member) return null;

      return {
        code: member.code,
        position: member.position,
        referrals: member.referrals,
        total: db.members.length,
        votes: db.votes.filter((vote) => vote.code === code).map((vote) => vote.feature),
      };
    };

    const randomCode = () => Math.random().toString(36).slice(2, 10);

    return {
      async join(email, ref) {
        await wait(450);
        const db = load();
        const clean = email.trim().toLowerCase();
        const existing = db.members.find((member) => member.email === clean);

        if (existing) return describe(db, existing.code);

        const validRef = db.members.some((member) => member.code === ref) ? ref : null;
        const member = { email: clean, code: randomCode(), refBy: validRef, createdAt: Date.now() };

        db.members.push(member);
        save(db);

        return describe(db, member.code);
      },

      async member(code) {
        await wait(150);
        return describe(load(), code);
      },

      async stats() {
        await wait(150);
        const db = load();
        const votes = {};

        db.votes.forEach((vote) => {
          votes[vote.feature] = (votes[vote.feature] || 0) + 1;
        });

        return {
          total: db.members.length,
          leaderboard: rank(db)
            .slice(0, 5)
            .map((member) => ({ name: maskEmail(member.email), referrals: member.referrals })),
          votes,
        };
      },

      async vote(code, feature) {
        await wait(200);
        const db = load();
        const index = db.votes.findIndex((vote) => vote.code === code && vote.feature === feature);
        const owned = db.votes.filter((vote) => vote.code === code).length;

        if (index >= 0) db.votes.splice(index, 1);
        else if (owned < Config.maxVotes) db.votes.push({ code, feature });

        save(db);

        return describe(db, code);
      },
    };
  };

  const createRemoteAdapter = () => {
    const call = async (name, body) => {
      const response = await fetch(`${Config.supabaseUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          apikey: Config.supabaseKey,
          Authorization: `Bearer ${Config.supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`Cererea ${name} a eșuat (${response.status})`);

      return response.json();
    };

    return {
      join: (email, ref) => call("join_waitlist", { p_email: email, p_ref: ref || null }),
      member: (code) => call("member_info", { p_code: code }),
      stats: () => call("get_stats", {}),
      vote: (code, feature) => call("toggle_vote", { p_code: code, p_feature: feature }),
    };
  };

  const adapter = useRemote ? createRemoteAdapter() : createLocalAdapter();

  return { ...adapter, mode: useRemote ? "supabase" : "local" };
})();