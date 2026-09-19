# FitNerve Backend

Node.js + Express + PostgreSQL (via Prisma) REST API for the FitNerve fitness platform. Auth/JWT with role-based access (USER/COACH/ADMIN), real-time chat (Socket.io), push notifications (FCM), content CMS, admin analytics, workout/appointment/calendar management (including an optional read-only Google Calendar sync), transactional email via SMTP, and admin/coach web portals served straight from this API.

## Stack

- Express 4, PostgreSQL via Prisma ORM
- JWT auth (access + refresh tokens), bcrypt password hashing
- Socket.io for real-time chat and presence
- Firebase Admin (FCM) for push notifications
- Nodemailer (SMTP) for OTP/password-reset emails
- googleapis (OAuth2 + Calendar API) for the optional Google Calendar connection
- Zod for request validation, Winston for logging
- Swagger (OpenAPI) docs generated from route JSDoc comments

## Getting started

```bash
cp .env.example .env      # fill in DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ...
npm install
npx prisma generate
npx prisma migrate dev
npm run dev                # http://localhost:4000
```

- Admin portal: `http://localhost:4000/admin`
- Coach portal: `http://localhost:4000/coach`
- Swagger API docs: `http://localhost:4000/api-docs`
- Health check: `http://localhost:4000/api/v1/health`

## Environment variables

Every variable is read in `src/config/env.js`; `.env.example` lists them all with inline comments. Highlights:

| Area | Vars | Notes |
|---|---|---|
| Core | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Required — the app exits on boot if any are missing. |
| Storage | `STORAGE_DRIVER`, `S3_*` | `local` (disk under `uploads/`) by default; set to `s3` for any S3-compatible provider (e.g. Tigris) — needed on hosts with an ephemeral filesystem. |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Sends OTP/password-reset emails via Nodemailer. `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` and `SMTP_FROM_NAME` are accepted as alternate spellings. Unset in development, the app logs a warning and skips sending. **In production a failed send returns an error** instead of pretending the code was sent. See *Email delivery* below. |
| OTP | `OTP_EXPIRES_MIN`, `OTP_MAX_ATTEMPTS`, `OTP_BYPASS_CODE` | `OTP_BYPASS_CODE` is a **temporary** escape hatch, off unless set. When set, that code is accepted for **any** account in place of the emailed one, so leave it unset in real deployments. |
| Push | `FCM_SERVICE_ACCOUNT_BASE64` | Base64-encoded Firebase service account JSON. |
| Google Calendar | `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET`, `GOOGLE_CALENDAR_SCOPES`, `GOOGLE_TOKEN_ENCRYPTION_KEY` | Enables `/calendar/google/*`. The app fetches the client IDs from this API at connect time, so they must be set here. The web client secret is required only for the web flow. Encryption key: `openssl rand -hex 32`. Without these the endpoints return a config error but nothing else is affected. |
| Cron | `ENABLE_CRON`, `REMINDER_SWEEP_CRON` | Workout/appointment reminder sweep. |

## Scripts

```bash
npm run dev                  # nodemon, watches src/ and .env
npm start                    # production start
npm run prisma:generate
npm run prisma:migrate       # dev migration
npm run prisma:migrate:deploy
npm run prisma:studio
npm run lint
```

## Notable features

- **Auth**: JWT access/refresh, OTP-based registration + password reset, role-based middleware (USER/COACH/ADMIN). Password reset is two-step: `POST /auth/verify-reset-code` checks the code without using it up, then `POST /auth/reset-password` consumes it with the new password. Usernames are generated from the email and editable.
- **Real-time chat**: Socket.io `/chat` namespace (typing, presence, delivered/seen receipts) with a REST fallback covering the same operations; an AI coach reply endpoint sits alongside it.
- **Calendar**: `/calendar/upcoming` merges internal appointments + scheduled workouts with, if connected, the user's Google Calendar events. Google connection lifecycle (`connect/start`, `exchange`, `status`, disconnect) lives under `/calendar/google/*` — OAuth2 Authorization Code + PKCE, tokens encrypted at rest (AES-256-GCM), auto-refresh, auto-disconnect on a revoked grant.
- **Admin & coach portals**: static sites served directly from this API under `/admin` and `/coach`, including a built-in database explorer.

## Email delivery

Email goes out through SMTP (Nodemailer). It works locally, but **many hosts, including Render's free tier, block outbound SMTP ports** (25/465/587), so sends time out there. Options: use an HTTPS-based email API (Brevo, Resend, SendGrid), a paid host plan, or a host that allows SMTP. Gmail needs an app password, not the account password.

## Google Calendar setup

1. Create OAuth clients in Google Cloud Console (Android, iOS and Web), and enable the **Google Calendar API**.
2. **Android client:** package `com.fitnerve.app`, the SHA-1 of the EAS keystore (`npx eas credentials`), and **Advanced settings → Enable custom URI scheme**.
3. **Web client:** add each site origin (e.g. `http://localhost:8081` and the deployed URL) to both *Authorized JavaScript origins* and *Authorized redirect URIs*, and set `GOOGLE_WEB_CLIENT_SECRET`.
4. If the consent screen is in *Testing*, add your Google account under **Test users**.
5. Set the `GOOGLE_*` variables above on the server (and redeploy).

## Project structure

```text
src/
├── config/       # env, logger, firebase, swagger
├── controllers/  # one per resource, thin — delegates to services
├── services/     # business logic
├── repositories/ # Prisma data access, one per model/domain
├── routes/v1/    # Express routers, mounted in routes/v1/index.js
├── middlewares/  # auth, validation, rate limiting, uploads, error handling
├── validators/   # Zod request schemas
├── utils/        # cross-cutting helpers (jwt, password, email, crypto, ...)
├── sockets/      # Socket.io namespace gateways
└── jobs/         # node-cron reminder sweeps
prisma/
├── schema.prisma
└── migrations/
admin/, coach/    # static portal frontends served by this API
```

## Deployment

`render.yaml` is set up for Render (web service) + any Postgres provider (e.g. Neon or Prisma Postgres). Socket.io needs a long-lived process, so use a host that keeps a process running, not a serverless one such as Vercel. Variables marked `sync: false` in `render.yaml` must be added by hand in the Render dashboard, and values are entered without quotes. The start command runs `prisma migrate deploy`, so the database must be reachable from the host. Set `CORS_ALLOWED_ORIGINS` for any browser-based client (web build, or the admin/coach portals if hosted separately) — native app requests aren't subject to CORS.
