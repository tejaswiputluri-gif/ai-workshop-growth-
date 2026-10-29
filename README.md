# AI Workshop Growth System

React + FastAPI + SQLite prototype for the simulated NxtWave growth challenge.

## Status and scope

- This repository contains a working local prototype; it has **not** been deployed or used to collect real student registrations.
- The target of 500 registrations and the channel plan are projections, not results.
- SQLite is stored locally in `growth.sqlite3` (or `DATABASE_PATH`). This is not durable hosting and is not suitable for real campaign data on an ephemeral platform.
- Do not use real student data until persistent storage, admin access, privacy/retention terms, workshop details and organiser approvals are confirmed.
- Confirmed workshop details are limited to a free, beginner-friendly, 60-minute online workshop. The date, time, platform, recording, project tools and proposed rewards remain unconfirmed and are labelled accordingly.

## Run locally

Prerequisites: Node.js 18+ and Python 3.10+.

1. Install frontend packages: `npm install`
2. Install backend and document/test packages: `python -m pip install -r requirements-dev.txt`
3. Configure an admin token in PowerShell:

   ```powershell
   $env:ADMIN_TOKEN = "replace-with-a-long-random-secret"
   $env:DATABASE_PATH = ".\growth.sqlite3"
   $env:FRONTEND_ORIGIN = "http://127.0.0.1:5173"
   ```

4. In one terminal run the API: `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`
5. In another terminal run React: `npm run dev`
6. Open `http://127.0.0.1:5173`; the public pages are `/`, `/agenda`, `/register`, `/referrals`, and `/leaderboard`. Admin: `http://127.0.0.1:5173/admin`.

The admin page has no default password: configure `ADMIN_TOKEN` first. The admin token is sent in an HTTP header and kept in session storage for the current browser tab. Use HTTPS and a strong secret in any hosted environment.

## Features

- Responsive Home page with the workshop value proposition, audience, details, 500-registration target and registration CTA.
- Separate Workshop Agenda and Register pages; registration collects name, email, WhatsApp, college, branch, graduation year, optional referral code and communication consent. The default graduation year is next year, with a range of nearby years available.
- API-side validation, honeypot, per-IP in-memory rate limit, case-insensitive email uniqueness, randomly generated referral code, invalid-code rejection and self-referral prevention.
- Student Referral Dashboard with a unique link/code, copy and WhatsApp sharing, live successful-referral count and proposed 3/10 milestones. It can reuse the code from the current browser session or accept a registration code.
- Separate public Referral Leaderboard with first names, codes and referral counts only. College-wise standings and recent referral activity are not published or supported.
- Public aggregate counts and top referrers by first name/code only; no personal registration record endpoint is public.
- Admin-token-protected metrics, first-touch channel attribution, optional UTM attribution, unique tracked visitors, referral codes, daily trend, registration search and CSV export.
- Admin-only demo records labelled `DEMO`; they are excluded from public totals and real registration metrics.
- Personalised AI project ideas, production bot protection and persistent cloud deployment were skipped. These are not needed to validate the MVP flow; the local prototype still needs durable storage and stronger production controls before real use.

Example campaign links: `/?utm_source=clubs&utm_medium=whatsapp&utm_campaign=workshop`, `/?utm_source=ambassadors`, and `/?utm_source=placement`. A referral share uses `/?ref=CODE`; source and inviter are stored separately.

Attribution uses one first-touch channel per registration: `utm_source` takes precedence, then the `src`/source value, then `referral` for a referral-only link, and otherwise `direct`. A valid referral code is stored independently and reported as referral performance, so it does not add a second channel registration. Conversion uses unique browser-session visitor IDs that were tracked and then registered; it is unavailable when visit tracking is absent. Visitor IDs are not included in the admin registration response or CSV export.

## SQLite schema

`registrations`: `id`, `name`, `email` (unique, case-insensitive), `phone`, `college`, `branch`, `year`, `code` (unique referral code), `referral_code` (inviter FK), `source` (single first-touch channel), `visitor_id` (anonymous session attribution), `utm_source`, `utm_medium`, `utm_campaign`, `created_at` (UTC ISO timestamp), `is_demo`.

`visits`: `id`, `source`, `created_at`, `visitor_id`, `utm_source`, `utm_medium`, `utm_campaign`. New attribution fields are added to existing SQLite files during startup. The database is initialised in `backend/main.py`; indexes support date, source, referral and unique-visitor queries.

## API routes

- `GET /api/health`
- `POST /api/visit`
- `POST /api/register`
- `GET /api/stats`
- `GET /api/me/{code}`
- `GET /api/admin/data` (admin token required)
- `GET /api/admin/export.csv` (admin token required)
- `POST /api/admin/demo` and `DELETE /api/admin/demo` (admin token required)

## Deploy to Render

The `Dockerfile` builds the React app and packages it with FastAPI, so a single Render web service serves the website, `/admin`, and `/api/*`. The API serves the built React files; no separate frontend service or public API key is needed. The default `render.yaml` requests a paid service with a persistent disk at `/var/data`. The alternative `render-free.yaml` is a no-cost demo path with an ephemeral database.

The public pages are served by the same single-page application at `/`, `/agenda`, `/register`, `/referrals`, and `/leaderboard`; `/admin` is a separate private dashboard route. The leaderboard only uses public aggregate API data. Personal registration details remain behind the admin-token-protected API.

### Choose the right option before deploying

- **Persistent registrations (recommended if you expect data to survive restarts):** use `render.yaml`. The Blueprint requests a persistent disk at `/var/data` for the paid service; review the requested plan, disk and current recurring prices before applying it. This is a recurring hosting cost, not part of the simulated ₹2,000 campaign budget.
- **Free demo only:** use `render-free.yaml`. Set `DATABASE_PATH` to `/tmp/growth.sqlite3` (not `/var/data/...`; free services cannot attach persistent disks). Render free web services sleep when idle and have an ephemeral filesystem; SQLite registrations can disappear after restarts, deploys or spin-down. The app displays a temporary-storage warning. Do not use this option to collect real registrations.

### Steps

1. Push this project to a GitHub repository you control. This workspace is inside a subfolder of a larger repository; from the repository root, stage only `ai-workshop-growth/ai-workshop-growth` (or create a separate repository for this project). Review the staged files so you do not include unrelated existing changes. Do not commit `.env`, secrets, or any `.sqlite3` database.
2. Sign in to Render and choose **New → Blueprint**; connect your GitHub repository. When asked for the Blueprint path, enter `ai-workshop-growth/ai-workshop-growth/render.yaml` for persistent deployment or `ai-workshop-growth/ai-workshop-growth/render-free.yaml` for the free demo.
3. The Blueprint sets Render's service root directory to `ai-workshop-growth/ai-workshop-growth`; this lets Render find this project's Dockerfile and React/Python files in the repository subfolder. Review the Blueprint before applying it.
4. When prompted for `ADMIN_TOKEN`, enter a new, long, random secret. Use a password manager and do not put the value in GitHub or frontend variables.
5. For persistent storage, confirm the Blueprint's paid web-service plan and persistent disk mount at **`/var/data`**. Confirm the recurring price before creating/upgrading the service. The app writes its SQLite database to `/var/data/growth.sqlite3`.
6. Wait for the Docker build and deploy to finish. Render uses `/api/health` as its health check. Visit the service's `https://<your-service>.onrender.com/` URL and `/admin`.
7. Test a synthetic registration with an `example.test` email, then check `/admin` using the `ADMIN_TOKEN` you configured. Verify duplicate rejection and the referral count before sharing the URL.
8. If you ever decide to stop hosting, export any needed data and delete the Render service/disk through the dashboard. Do not assume deleting a GitHub repo deletes Render resources.

### Render configuration and limitations

- `Dockerfile`: Node 22 builds React; Python 3.12 runs FastAPI and serves the React build.
- `render.yaml`: paid plan with a persistent disk configured at `/var/data`. Verify the disk is mounted and `/api/health` reports `persistent` after deployment; this repository configuration alone does not prove that the hosted service was deployed or that data survived a restart. Keep a single service instance when using SQLite.
- `render-free.yaml`: free demo plan; SQLite path `/tmp/growth.sqlite3`, no disk, `STORAGE_MODE=ephemeral`. The API health check verifies it can query SQLite, and the public page warns that demo registrations can be lost.
- `ADMIN_TOKEN`: configured in Render's environment UI from the Blueprint's `sync: false` prompt. It is not stored in code or exposed as a frontend variable.
- `DATABASE_PATH`: set by the selected Blueprint. No `VITE_API_URL` or cross-origin setup is necessary because the frontend and API share one origin.
- SQLite and the in-memory rate limiter are appropriate only for a small prototype/single service instance. Before any real campaign, use managed persistent Postgres (and durable rate limiting), enable backups, review consent/data-retention wording and access controls, and get organiser approval.
- Deployment is not complete until you connect your GitHub repo, choose a plan, set the secret, and verify the resulting Render URL. No live Render URL is currently configured.

Render references: [Blueprints](https://render.com/docs/blueprint-spec), [free instance limitations](https://render.com/docs/free), [persistent disks](https://render.com/docs/disks).

## Test and demo checklist

- Install the browser once for end-to-end UI tests: `npx playwright install chromium`
- Run automated API tests: `python -m pytest -q`
- Run real-browser registration, referral and mobile tests: `npm run test:e2e`
- Build React assets: `npm run build`
- Start both servers and check `/api/health`, registration validation, duplicate email, valid/invalid/self referral attribution, UTM persistence, public privacy, admin auth, demo-data labeling/removal and mobile width.
- Use only synthetic `example.test` data. To clear demo records, sign in at `/admin` and choose **Clear DEMO**; normal test registrations are separate and require deleting the local SQLite file only after stopping the API.
- Inspect `growth-plan.md`, `learning-notes.md`, `submissions/growth-challenge.pptx`, and `submissions/growth-plan-two-pages.docx`.

## Deliverables and remaining manual steps

- `growth-plan.md`: detailed strategy, funnel, budget and seven-day plan.
- `submissions/growth-challenge.pptx`: five-slide visual summary.
- `submissions/growth-plan-two-pages.docx` and `.pdf`: concise two-page plan (PDF page count is verified by the generator).
- `learning-notes.md`: fill-in AI learning examples, reflection structures and 3-minute demo script.
- `test-report.md`: validation results and remaining limitations.
- `src/` and `backend/main.py`: source for the React/FastAPI prototype.

The workshop date/platform/project/rewards still need organiser confirmation. No live deployment was verified during this work. Fill AI-learning/reflection placeholders from your real experience; record the video yourself and do not claim campaign results.
