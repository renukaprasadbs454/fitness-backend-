# FitNerve Backend — Phase 1

Production-style Node.js/Express/PostgreSQL/Prisma backend covering Phase 1 scope only: **Authentication, User Profile, Coach Module, Image Uploads, and backend infrastructure.**

Full design docs: [`docs/PHASE1_DOCUMENTATION.md`](./docs/PHASE1_DOCUMENTATION.md) (ER diagram, API spec, auth flow, frontend mapping, security, roadmap, testing checklist).

## Folder Structure

```
backend/
├── src/
│   ├── config/         env.js, logger.js
│   ├── constants/       roles.js, httpStatus.js
│   ├── controllers/    auth, user, coach, upload
│   ├── services/       business logic per module
│   ├── repositories/   Prisma queries only, isolated from services
│   ├── routes/v1/      versioned route definitions + Swagger JSDoc
│   ├── middlewares/    auth, role, validate, rateLimiter, error, upload
│   ├── validators/     Zod schemas
│   ├── utils/          ApiError, ApiResponse, asyncHandler, jwt, password, storage, ms
│   ├── docs/           swagger.js (OpenAPI spec generator)
│   ├── database/       Prisma client singleton
│   ├── app.js
│   └── server.js
├── prisma/schema.prisma
├── postman/FitNerve-Phase1.postman_collection.json
├── docs/PHASE1_DOCUMENTATION.md
└── .env.example
```

## 1. Prerequisites

- Node.js ≥ 18
- A running PostgreSQL instance (local, Docker, Railway, or Render)

## 2. Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` — at minimum set `DATABASE_URL` to your Postgres connection string, and replace `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` with strong random values, e.g.:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Database

```bash
npm run prisma:generate     # generates the Prisma client from schema.prisma
npm run prisma:migrate      # creates the tables (users, refresh_tokens, password_reset_tokens,
                             # user_profiles, coaches, coach_availability, media)
```

> **Note:** this repo's schema and code were validated by static review (syntax-checked, wiring traced) in an offline sandbox that couldn't reach Prisma's binary CDN. The above two commands are the first thing to run in your real environment — they haven't been executed against a live database yet.

## 4. Run

```bash
npm run dev     # nodemon, auto-reload
# or
npm start       # plain node
```

- API base: `http://localhost:4000/api/v1`
- Swagger UI: `http://localhost:4000/api-docs`
- Health check: `GET /api/v1/health`

## 5. Postman

Import `postman/FitNerve-Phase1.postman_collection.json`. The `baseUrl` variable defaults to `http://localhost:4000/api/v1`. Running **Register** or **Login** auto-populates the `accessToken`/`refreshToken` collection variables for subsequent requests via a test script.

## 6. File Storage

Controlled by `STORAGE_DRIVER` in `.env`:
- `local` (default) — files saved under `uploads/`, served statically at `/uploads/...`
- `s3` — set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`

No code changes needed to switch — the storage abstraction (`src/utils/storage.js`) is driver-agnostic.

## 7. Deployment (Railway / Render / EC2)

1. Provision a managed Postgres instance and copy its connection string into `DATABASE_URL`.
2. Set all `.env.example` keys as environment variables in your platform's dashboard (never commit `.env`).
3. Build step: `npm install && npm run prisma:generate`
4. Release/pre-deploy step: `npm run prisma:migrate:deploy`
5. Start command: `npm start`
6. Set `STORAGE_DRIVER=s3` in production — local disk storage doesn't persist across container restarts/redeploys.

## 8. What's explicitly out of scope (Phase 2 / Phase 3)

BMI, Calorie, Activity/Steps, Workouts, Progress logs, Appointments, Calendar, Chat (Socket.io), Notifications (FCM), Content, Admin analytics. See `docs/PHASE1_DOCUMENTATION.md` §8 for the roadmap into those phases.
