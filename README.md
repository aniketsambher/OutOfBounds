# Out of Bounds

Pop your campus bubble. Students collect stamps at local eats, landmarks and parks across Boston neighborhoods, and their campus captures turf zones around other schools.

Built for BostonHacks, track **Boundless Boston**.

## Run it locally

Two terminals, from this folder:

```powershell
npm --prefix server install
npm --prefix server run dev
```

```powershell
npm --prefix web install
npm --prefix web run dev
```

Open http://localhost:5173. The web app talks to the API on port 8787 (Vite proxies `/api`).

- **Without the server** the app still works, in offline mode: progress stays on that device and Profile says "Offline". When the server comes back, that progress is added to the player's account (it counts for their passport, not for the shared turf map).
- **With the server** it's a shared game: everyone sees the same turf map and gets live capture alerts. Profile says "Live: shared game".
- With no `server/.env`, the server uses an embedded local Postgres stored in `~/.out-of-bounds/pglite` (outside OneDrive on purpose). Set `DATABASE_URL` to use Tiger Data instead; see [SETUP.md](SETUP.md).

## Features

| Screen | Route | What it does |
|---|---|---|
| Welcome | `/welcome` | Name, campus picker with school logos, optional demo progress |
| Passport | `/` | Stamps, check-ins by type, points, next quest (picked by Gemini when configured) |
| Explore map | `/explore` | OpenStreetMap, your bubble ring, neighborhood pins, filters for eats / bakeries / landmarks / parks |
| Neighborhood quest | `/n/:id` | Food + landmark + park quests, GPS check-in, "+ Photo" check-in verified by Gemini, phrase card with text-to-speech |
| Stamp earned | `/stamp/:id` | Stamp animation, points, 2× away bonus, mix bonus, capture card, share |
| Turf map | `/turf` | Campus zones colored by holder, school logos, live stamp counts, check-in at campus posts |
| Bubble Cup | `/cup` | Campus leaderboard with zones held |
| Profile | `/me` | Live/offline status, team access, visitor/demo mode, simulate rival, reset turf, reset progress |

## Game rules (`shared/game.ts`, used by both web and server)

- **Neighborhood stamp:** check in at 2 places in a neighborhood. **Mix bonus** +100 for food + a landmark or park, once per neighborhood.
- **Points:** 100 per check-in, 2× inside a rival campus's zone, 2× in the weekly challenge neighborhood (`weeklyChallenge` in `shared/seed.ts`). The multipliers stack.
- **Turf:** most stamps in a zone this week owns it; ties go to the home campus; within 2 stamps = contested. The week resets at Sunday midnight, Boston time.

## Who can do what (public site)

| Player | Check in without GPS | Counts on the shared turf map | Demo controls (simulate, reset turf) |
|---|---|---|---|
| **Team account** (entered `TEAM_KEY` in Profile) | Yes | Yes | Change the shared game |
| **Visitor** (everyone else, `VISITOR_MODE=true`) | Yes | No: those stamps show only for them | Change only their own view |
| Anyone with GPS on, within 200 m | n/a | Yes | n/a |

- Each player only ever sees their own stamps and points. The shared turf map shows totals per campus, never who did what.
- `ALLOW_DEMO=true` gives every account team powers. Use it for local development only.
- The server limits sign-ups, check-ins, photo checks and team password tries, caps uploads at 4 MB, and caps Gemini calls per day (`GEMINI_DAILY_LIMIT`).

## API (server/src/index.ts)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Status: database type, Gemini on/off, team access, visitor mode |
| POST | `/api/players` | Create a player → token (can bring check-ins made offline) |
| GET | `/api/me` | Player + check-ins (Bearer token) |
| DELETE | `/api/me` | Delete the player and their check-ins ("Sign out and start over") |
| POST | `/api/me/team` | Become a team account with the team password |
| POST | `/api/me/import` | Add check-ins made offline on the device |
| POST | `/api/me/reset` | Reset this player's progress (same account) |
| POST | `/api/checkins` | Check in (GPS, team, or visitor; optional photo) |
| GET | `/api/turf` | Stamp counts per campus per zone this week |
| GET | `/api/events` | Live capture alerts and turf refreshes (server-sent events) |
| GET | `/api/quest-tip` | Next neighborhood suggestion (Gemini, with fallback) |
| POST | `/api/simulate` | Team only: add rival stamps |
| POST | `/api/demo/reset-turf` | Team only: turf back to the starting counts (everyone keeps their stamps) |

In production the same server also serves the built web app from `web/dist`.

## Stage demo script

Both phones need team access first: Profile → **Team access** → enter the team password (or run the server with `ALLOW_DEMO=true`).

1. Profile → **Reset turf for everyone** (BU zone back to a 40–40 tie).
2. Phone A: sign up as Northeastern with demo progress. Phone B: sign up as BU. Unlock team access on both.
3. Both open **Turf**.
4. Phone A checks in at the **Citgo sign**: "Huskies captured BU!" on A, "Huskies took BU from you" on B, live.
5. Phone A: **Dorchester quest** → Pho Hoa (try **+ Photo** with a food picture) + JFK Library → stamp + mix bonus.
6. Phone A: Profile → **Simulate BU retaking its zone**, or Phone B checks in at Marsh Plaza, to fight back.

## Sample data to check before demoing (`shared/seed.ts`)

- Place coordinates are approximate.
- `placeholder: true` entries are generic "local picks". Swap in real family-run businesses.
- Zone baseline counts and Bubble Cup averages are made up.
- School logos in `web/public/logos/` come from Wikipedia / Wikimedia Commons.

## Project layout

```
shared/        types, seed data, game rules (used by web + server)
server/        Hono API: Postgres (Tiger Data) or embedded PGlite, Gemini, live events
web/           React + Vite installable web app
SETUP.md       accounts, environment variables, deployment to Vultr
```
