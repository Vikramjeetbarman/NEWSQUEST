# NewsQuest — *Read today. Rank tomorrow.*

A full-stack current-affairs trainer. It pulls daily releases from the **Press Information Bureau (PIB), Government of India** and **News On AIR (Prasar Bharati)** (public RSS feeds), writes section-wise and topic-wise digests, and turns every story into exam-style MCQs that you play in a gamified arena with XP, levels, streaks, coins, power-ups, achievements and leaderboards. You can save any question to a personal **Vault** and practise it later for competitive exams (UPSC, SSC, banking, state PSCs).

**Attribution:** every story and question credits its source (e.g. "Source: Press Information Bureau (PIB), Government of India") and links to the original release. The footer states that NewsQuest is independent and not affiliated with or endorsed by the Government of India or Prasar Bharati. Check each source's copyright policy before a public launch.

## Quick start

Create a PostgreSQL database for the app (any supported version, 13+; developed on 18):

```powershell
psql -U postgres -c "CREATE ROLE newsquest LOGIN PASSWORD 'choose-a-password'" -c "CREATE DATABASE newsquest OWNER newsquest"
```

Put its URL in `server/.env` (see `server/.env.example`). The server creates its tables on start.

```env
DATABASE_URL=postgres://newsquest:choose-a-password@localhost:5432/newsquest
```

Then:

```powershell
npm install            # installs root, server and client workspaces
npm run dev            # API on :8787 + Vite on :5173 (open http://localhost:5173)
```

Production build (one process serves the API and the built SPA):

```powershell
npm run build
npm start              # http://localhost:8787
```

Requires **Node 22.15+** and **PostgreSQL** (developed on Node 24 and PostgreSQL 18).

| Script | What it does |
| --- | --- |
| `npm run dev` | API (watch mode) and Vite dev server together |
| `npm run build` | Type-checks and builds the client into `client/dist` |
| `npm start` | Starts the API, which also serves `client/dist` |
| `npm run typecheck` | Client TypeScript check |
| `npm run selftest` | Runs the NLP + question generators over the demo archive (in a throwaway schema) and prints samples and an integrity report |
| `npm run test:api` | API + login end-to-end checks against a running API on :8787 (creates `tester_*` accounts) |

Everything under `testing/` is optional and not needed to run the app:

| Path | Purpose |
| --- | --- |
| `testing/selftest.mjs` | Question-generator self-test (`npm run selftest`) |
| `testing/api/api-checks.mjs` | 38 API checks: news, quiz, vault, profile, leaderboard, concurrency guards |
| `testing/api/auth-e2e.mjs` | 15 checks: guest play, streak, vault, register, re-login, rank |
| `testing/api/smoke.mjs` | Quick API smoke test |
| `testing/tools/strip-comments.cjs` | `node testing/tools/strip-comments.cjs <projectRoot> [--dry]` removes comments from source files |
| `testing/tools/unused-exports.cjs` | `node testing/tools/unused-exports.cjs <projectRoot>` lists exports nothing imports |

## Features

- **Live news pipeline:** the PIB and News On AIR RSS feeds are polled every `FETCH_INTERVAL_MINUTES` (default 5, minimum 1). New stories are de-duplicated, classified into 10 sections, and summarised (TL;DR + key points). Keywords and entities (people, places, organisations, schemes, laws, reports, awards) are extracted. New-story alerts reach the browser instantly over Server-Sent Events, and a toast and the live ticker update without a reload.
- **Section digests:** for each section you get a brief, a theme cloud, storyline clusters (as a timeline), "numbers in news", and an **exam lens** of people, places, schemes, laws and reports.
- **14 question types:**
  - Headline Hunt, Fill in the Blank, Numbers in News, Spot the Fact, Spot the Error.
  - True/False, UPSC-style multi-statement, Match the Following, Odd One Out.
  - Subject Mapper, Keyword Link, Acronym Decoder, Map Master, Who's Who.
  - Each question has four difficulty levels, an explanation and a link back to its source.
- **Game modes:**
  - Classic (custom sections, difficulty, types and length).
  - Blitz (90 s).
  - Survival (3 lives).
  - Daily Challenge (same set for everyone, 1.5x XP).
  - Story quiz.
  - Vault Practice (untimed; a question counts as mastered after you answer it correctly 3 times).
- **Gamification:**
  - XP with combo and speed bonuses, levels and titles, a day streak, and coins.
  - Power-ups: 50:50, +15 s, Skip.
  - Achievements in 4 tiers, and weekly and all-time leaderboards.
  - Profile with a section-mastery radar chart, an activity heatmap and accuracy charts.
  - **Vault:** save, annotate, filter and master questions. Export them as CSV or JSON.
- **Visuals:**
  - A 3-D canvas news globe and a particle constellation background.
  - Framer Motion page transitions and spring animations.
  - Confetti, a level-up modal and Web Audio sound effects (with a mute toggle).
  - Respects `prefers-reduced-motion`.
- **Accounts:** instant guest play. Registering later upgrades the guest account in place, so progress is kept.

## Configuration (`server/.env`, see `server/.env.example`)

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://newsquest@localhost:5432/newsquest` | PostgreSQL connection string. Hosted databases usually need `?sslmode=require` on the end. |
| `DATABASE_SCHEMA` | `public` | Optional schema to use instead, e.g. when sharing a database |
| `PORT` | `8787` | |
| `FETCH_INTERVAL_MINUTES` | `5` | 1-1440. Use `1` for "every minute". |
| `DEMO_FALLBACK` | `true` | Shows a built-in archive of 30 stories (331 questions) when feeds are unreachable |
| `FULL_TEXT_MODE` | `ondemand` | `off` / `ondemand` ("Deep read" button) / `background` |
| `MAX_ARTICLE_AGE_DAYS` | `7` | Older live stories are pruned |
| `APP_TIMEZONE` | `Asia/Kolkata` | Day boundary for streaks and the daily challenge |
| `OPENAI_API_KEY` | | Optional. Enables AI-written bonus questions per story. |
| `OPENAI_BASE_URL`, `OPENAI_MODEL` | OpenAI, `gpt-4o-mini` | Any OpenAI-compatible endpoint |
| `AI_AUTO_ENHANCE` | `false` | Auto-run AI on the newest stories |
| `COOKIE_SECURE` | `true` in production | Set to `true` when serving over HTTPS |

## Corporate networks / demo mode

If a proxy or firewall (e.g. Zscaler) blocks pib.gov.in or newsonair.gov.in, each feed is shown as **Blocked** on the *Sources* page. A banner explains that the app is running on the **Demo Archive**. Everything still works on the archive. The scheduler keeps retrying, and the app switches to live news automatically the first time a fetch succeeds, for example on a home network. The app does not attempt to bypass network controls.

## Architecture

```
server/ Express 4 (ESM) + PostgreSQL (node-postgres)
  src/db.js                 connection pool, schema (created on start), query + transaction helpers
  src/services/fetcher.js   RSS fetch with SSRF host allow-list, block-page detection
  src/services/pipeline.js  ingest -> analyse -> generate questions; scheduler; SSE broadcast
  src/nlp/                  sentence split, keywords (TF-IDF + phrases), entities, summaries, digests
  src/quiz/                 question generators, quiz sessions, scoring, achievements
  src/routes/               auth, news, quiz/vault/profile/leaderboard
client/ Vite + React 18 + TypeScript + Tailwind + Framer Motion
  src/pages/                Home, News, Article, Arena, Play, Vault, Profile, Leaderboard, Sources, Auth
  src/components/           globe, charts, question renderer, cards, navbar, ticker
```

## Security notes

- **Passwords and sessions:** passwords are hashed with scrypt. Sessions use opaque, HttpOnly, SameSite=Lax cookies.
- **CSRF protection:** state-changing requests must have a matching `Origin` header and a JSON body.
- **Rate limits:** login, registration, refresh and AI endpoints are rate-limited.
- **SQL and SSRF:** all SQL is parameterised. Outbound fetches are restricted to an allow-list of news hosts.
- **Hidden answers:** answers are never sent to the client before the question has been answered, and saving an unanswered question is rejected.
- **CSV export:** cells are escaped against formula injection.
- **Browser hardening:** Helmet sets a strict Content Security Policy. External links are opened only if they use `https://`, with `noopener noreferrer`.

### Moving the database

All data (stories, questions, accounts and progress) lives in the PostgreSQL database named in `DATABASE_URL`. To move it to another server or a hosted provider (Neon, Supabase, Render, AWS RDS and so on), dump it and restore it there, then point `DATABASE_URL` at the new database:

```powershell
pg_dump -Fc -d "postgres://newsquest@localhost:5432/newsquest" -f newsquest.dump
pg_restore --no-owner --no-acl -d "<new DATABASE_URL>" newsquest.dump
```

`--no-owner --no-acl` lets the restore run as whatever role the new host gives you.

## Notes

- To reset everything, drop and recreate the database (`dropdb newsquest`, then `createdb -O newsquest newsquest`). To rebuild only the demo question bank with the latest generator rules, run `DELETE FROM articles WHERE is_demo = 1;` and restart the server.
- Quiz sessions are kept in server memory (and saved to the database), so run a single server process.
- Keeping `node_modules` inside a OneDrive-synced folder works but is slow. Consider excluding it from sync.