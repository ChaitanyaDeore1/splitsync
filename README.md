git add .
git commit -m "Add SplitSync application"
git push -u origin main# SplitSync

Splitwise-style expense sharing: React + TypeScript + Tailwind front end, Node/Express back end, PostgreSQL database, username-and-password sign-in.

## Requirements
Node 22.18+, Docker Desktop (for PostgreSQL).

## Run
```
copy .env.example .env        (macOS/Linux: cp .env.example .env)
npm install
npm run db:up                 # starts PostgreSQL in Docker
npm run dev                   # app on http://localhost:5173, API on :3001
```
Tables are created automatically on server start (`npm run db:migrate` runs migrations by hand). Create an account with a unique username and password. Existing email-OTP accounts can use the legacy sign-in option once to set username credentials. SMTP is only needed for email-code sign-in; without it, those legacy codes are printed in the server terminal.

For invitation links on another device on the same Wi-Fi, use the generated network link and allow port 5173 through your computer's firewall if prompted. `localhost` links work only on the computer that created them. For people outside your local network, deploy SplitSync to a publicly reachable HTTPS address.

`npm start` builds the app and serves everything on http://localhost:3001.

## Tests
`npm test` (needs the database running; 43 tests covering the API, money maths and screen rendering). Auth tests use a temporary schema, so your data is never touched.

## Database
`server/migrations/*.sql` run in order, each in a transaction; applied files are checksummed and cannot be edited afterwards (add a new numbered file instead). Money is stored as integer paise.

## Security
Passwords are hashed with scrypt; usernames are unique and case-insensitive. Login attempts are limited per username and client for 15 minutes. Password recovery by email is not enabled. Legacy OTP codes are hashed, expire in 10 minutes, work once, lock after 5 wrong tries, and can be re-requested every 30 seconds. Sessions are random tokens stored hashed in PostgreSQL and sent in an HttpOnly cookie. Session cookies are marked `Secure` when `NODE_ENV=production`; set `SESSION_COOKIE_SECURE=true` when serving HTTPS without that environment.

The development database port is bound to localhost only. Do not expose PostgreSQL directly to the internet.

## API (all under /api, JSON, session cookie)
Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/set-credentials`, legacy `POST /auth/request-otp` and `POST /auth/verify-otp`, `GET /auth/me`, `POST /auth/logout`.
Groups (sign-in required; every request checks you are a member, otherwise 404):
`GET /groups`, `POST /groups`, `GET /groups/:id`, `POST /groups/:id/members`, `GET /groups/:id/activity`,
`GET|POST /groups/:id/expenses`, `GET /groups/:id/suggestions`, `GET|POST /groups/:id/settlements`, `POST /groups/:id/invites`, `POST /groups/:id/leave`.
Friends and invitations: `GET /friends`, `GET /users/search?q=` (exact username; legacy email lookup is also accepted), `POST /friends/requests`, `POST /friends/requests/:id/accept|remove`, `GET /invites/:token`, `POST /invites/:token/accept`.
Timeline: `GET /timeline`, `GET /timeline.csv` (filters: group, category, type, from, to, q).
Analytics and recap: `GET /analytics?months=3..12&group=`, `GET /recap?month=YYYY-MM`, `GET /groups/:id/report?month=`.
Notifications: `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read-all`, `POST /notifications/:id/read`.
Shareable reports: `POST /reports/share` (`kind` monthly or group, `days` 1-90), `GET /reports/shares`, `POST /reports/shares/:id/revoke`; public, no sign-in: `GET /public/reports/:token`.
Amounts are integer paise. POSTs that move money need an `Idempotency-Key` header (8-100 characters): repeating a request with the same key returns the first result instead of saving twice. The server computes all splits and balances.

## What's new in this version
- **Monthly recap** (`/recap`): total spent, change vs last month, categories, groups, day-by-day chart, biggest expense, priciest day, payments sent/received. Month picker, CSV, print/PDF.
- **Analytics charts** (`/insights`, plus an Insights tab in every group): spending by month, category, group and weekday, drawn as plain SVG (no chart library).
- **In-app notifications** (bell in the top bar, `/notifications`): new expenses, payments, group adds and joins, friend requests, and a "recap ready" notice. Checked every 30 seconds, with a pop-up toast.
- **Shareable reports**: freeze a recap or group report as a read-only link (1-90 days). Public page at `/r/<token>`, no account needed. Links store only a hash, are not indexed, count views and can be turned off.
- **Guide** (`/guide`): searchable, with worked examples, FAQ, troubleshooting and glossary. The first-run tour was updated too.
- **Cleaner UI**: new sidebar and top bar, mobile menu, shared card/button/input styles, skeleton loading and empty states.

Everything lives in migration `003_notifications_reports.sql`, which is applied automatically on start. Your existing data is untouched.

## Current status
Working: sign-in, groups, members, expenses, balances, settlements, friends (find by exact email), group invitation and claim links, leaving a group, personal timeline with filters and CSV export, monthly recap, analytics charts, in-app notifications, shareable reports, in-app guide.
Still to build: editing/deleting expenses with audit history, settlement confirmation and disputes, polls, shopping lists, fair-split suggestions, recurring expenses, email/push notifications. Accounts from the earlier SQLite version are not copied over; sign in again.
