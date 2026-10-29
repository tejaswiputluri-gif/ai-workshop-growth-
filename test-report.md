# Prototype validation report

Latest checks run 2026-10-29. Validation uses synthetic `example.test` registrations only. No campaign or real-student data was used.

| Area | Result | Evidence |
|---|---|---|
| React production build | PASS | `npm run build` generated the `dist/` assets. |
| Dependency audit | PASS | `npm audit`: zero vulnerabilities. |
| FastAPI tests | PASS | `python -m pytest -q`: 15 passed, including API validation, admin access and React SPA/admin route fallback. |
| Browser tests | PASS | `npm run test:e2e`: all 4 browser tests passed, including registration/referral, privacy/admin access, mobile layout and public navigation. |
| Registration and duplicate handling | PASS | API and browser flow created a registration; trimmed, case-insensitive duplicate email returned HTTP 409. |
| Validation and consent | PASS | Automated API test rejects missing consent and unknown referral code. |
| Referral attribution and progress | PASS | Referral test created one attribution, inviter count became 1, and the UI shows 0/3 before a referral and 1/3 afterward. |
| Public privacy | PASS | Public stats and leaderboard contain aggregate/first-name-or-code fields, not email or phone. |
| Admin dashboard | PASS | Missing token returned HTTP 401; valid test token loaded admin data and records. |
| Dashboard calculations | PASS | Tests compare daily/source/referral totals to the stored registrations. |
| Demo data | PASS | 40 generated records are visibly marked DEMO, excluded from public count/real metrics, and removable. |
| CSV export | PASS | Admin-authenticated export returns a CSV header and registration rows. |
| Mobile layout | PASS | Browser test at 375px viewport found no horizontal overflow. |
| Slide deck | PASS | Regenerated `.pptx` contains exactly 5 slides. |
| Two-page plan | PASS | Regenerated DOCX and PDF; the PDF generator verifies exactly 2 pages. |
| Render configuration | PASS | Both Blueprint YAML files parsed and checked for Docker runtime, project root directory, database path and storage-mode settings. |
| SQLite health probe | PASS | `/api/health` queries the configured SQLite database and reports `ephemeral` for the Free demo. |
| Docker image build | NOT RUN | Docker is not installed in this environment. Render will build the checked-in `Dockerfile` during deployment. |

An initial root-level `pytest` run also collected an ignored scratch live-check script that requires a separately running app, so it failed before reaching the committed tests. Added `pytest.ini` to scope discovery to `tests/`; the normal root-level command then passed all 15 tests. The browser suite passed all 4 tests.

## Remaining limits

- Not deployed; no live URL or durable remote database is configured.
- The Render paid Blueprint requires you to attach a persistent disk manually at `/var/data`; the free Blueprint uses ephemeral storage and must not be used for real registrations.
- The Free demo is configured to write SQLite to `/tmp/growth.sqlite3`; Render may clear it when the service restarts, redeploys or spins down.
- The local SQLite database and in-memory rate limit are prototype-only.
- Event time, platform/recording, project details and referral rewards remain assumptions pending organiser confirmation.
- This does not constitute a legal/privacy review or production security assessment.
