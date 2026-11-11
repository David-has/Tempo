# Tempo — Waitlist Landing Page

A complete waitlist landing page for **Tempo**, a fictional day planner. Visitors join with their email, get a personal invite link, climb a referral leaderboard, unlock rewards, and vote on the features they want built first.

Built with plain HTML, CSS and JavaScript. No build step, no framework. Runs out of the box with `localStorage`, and switches to a real shared database (Supabase) by adding two keys.

> The page copy is in Romanian (`lang="ro"`). All text lives in `index.html` and `js/config.js`, so it is easy to translate.

## Features

- **Waitlist signup** with email validation, duplicate detection and a loading state
- **Referral system**: every member gets a unique code and invite link (`?ref=code`), with copy-to-clipboard and WhatsApp sharing
- **Live leaderboard** ranked by referrals (ties broken by who joined first), with masked emails such as `a***@gmail.com`
- **Reward tiers** unlocked by invites (1, 3 and 10), with an animated progress bar
- **Feature voting**: up to 3 votes per member, toggleable, with live percentage bars
- **Pricing section** (Free / Pro)
- **Light and dark mode**: follows the system setting, with a manual toggle that is remembered
- **Scroll motion**: staggered reveals, scroll progress bar and parallax background blobs
- **Fully responsive**, with a hamburger menu on mobile
- **Accessible**: keyboard focus styles, ARIA labels and live regions, and `prefers-reduced-motion` respected

## Two data modes

| | Local mode (default) | Supabase mode |
|---|---|---|
| Setup | none | add URL and key in `config.js` |
| Storage | browser `localStorage` | PostgreSQL |
| Data shared between visitors | no | yes |
| Seed data | 41 demo members and votes | empty |
| Best for | demos, portfolio, design review | a real waitlist |

The mode is chosen automatically in `js/api.js`:

```js
const useRemote = Boolean(Config.supabaseUrl && Config.supabaseKey);
```

Both adapters expose the same four methods (`join`, `member`, `stats`, `vote`), so the UI code never knows which one is active.

## Project structure

```
.
├── index.html        # markup and SVG icon sprite
├── style.css         # design tokens, layout, themes, responsive rules
├── schema.sql        # PostgreSQL schema and functions for Supabase
└── js/
    ├── config.js     # copy, features, rewards, vote limit, Supabase keys
    ├── api.js        # local and Supabase adapters behind one interface
    └── app.js        # rendering, events, theme, motion, confetti
```

## Getting started

### Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

To test referrals, open the page with a code from any member, for example `index.html?ref=seed0000`.

### Connect Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the whole of `schema.sql` and run it.
3. Open **Project Settings → API** and copy the *Project URL* and the *anon public* key.
4. Paste them into `js/config.js`:

```js
const Config = {
  supabaseUrl: "https://your-project.supabase.co",
  supabaseKey: "your-anon-public-key",
  // ...
};
```

Never use the `service_role` key in front-end code.

### Deploy to GitHub Pages

**Settings → Pages → Deploy from a branch → `main` / root.** The site is fully static, so nothing else is needed.

## Configuration

Everything you will want to change is in `js/config.js`.

| Option | Description |
|---|---|
| `supabaseUrl`, `supabaseKey` | Enables Supabase mode when both are set |
| `maxVotes` | Votes per member (default `3`) |
| `features` | Votable features: `id`, `title`, `text` |
| `rewards` | Reward tiers: `at` (invites needed), `title`, `text` |

Two rules to keep the database in sync with the front end:

- If you change `maxVotes`, also change the number `3` in the `toggle_vote` function in `schema.sql`.
- If you add or rename a feature `id`, update the `check (feature in (...))` list on the `feature_votes` table.

## How it works

**Ranking.** Members are sorted by number of referrals, descending, then by join time, ascending. A member's position is their rank in that list.

**Referrals.** Visiting `?ref=CODE` stores the code for that session. When the visitor joins, the code is saved as `referred_by` if it matches an existing member, and ignored otherwise. Joining again with the same email returns the existing member instead of creating a duplicate.

**Voting.** Clicking a feature toggles a vote. The server enforces the vote limit, and the interface also blocks and explains it.

**Persistence.** The browser remembers the member's code (`tempo-member`) and theme (`tempo-theme`), so the member view survives a reload. In local mode the whole database is stored under `tempo-db`. In Supabase mode, stats refresh every 30 seconds.

## Database (Supabase)

`schema.sql` creates two tables, `waitlist` and `feature_votes`, plus four functions callable from the browser:

| Function | Purpose |
|---|---|
| `join_waitlist(p_email, p_ref)` | Adds a member (or finds the existing one) and returns their info |
| `member_info(p_code)` | Position, referrals, total members and the member's votes |
| `toggle_vote(p_code, p_feature)` | Adds or removes a vote, up to the limit |
| `get_stats()` | Total count, top 5 leaderboard with masked emails, vote totals |

Row Level Security is enabled on both tables with no public policies, so visitors cannot read or write tables directly. All access goes through the `security definer` functions above, which never return full email addresses.

## Customizing the look

Colors, radius and shadow are CSS variables at the top of `style.css`, defined once for light and once for dark. Change `--accent` and `--accent-2` to re-theme the whole page. Section backgrounds use `--tone-lilac` and `--tone-peach`. Fonts are loaded from Google Fonts (Outfit).

## Production notes

This is a solid starting point, not a hardened product. Before running a large public campaign, consider adding:

- rate limiting or a CAPTCHA on `join_waitlist` to reduce spam signups
- email confirmation, so referral counts cannot be inflated with fake addresses
- a privacy policy and consent text, since you are collecting emails

## Browser support

Current versions of Chrome, Edge, Firefox and Safari. The page relies on `color-mix()`, CSS variables and `IntersectionObserver`.

## License

Add the license of your choice (for example MIT). Tempo is a fictional product created as a design example.
