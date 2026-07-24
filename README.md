# FitNerve — Unified Phase 3 Workspace

FitNerve is a consolidated fitness platform backend and admin portal built for Phase 3 delivery. This repository combines the production-ready backend API, admin portal frontend, shared authentication, role-based access control, and a single Prisma schema with environment-driven configuration.

## Project overview

This workspace includes:
- Backend API server with Phase 1, Phase 2, and Phase 3 features.
- Real-time chat via Socket.io.
- Push notification support with FCM integration.
- Content management APIs for blog posts, tips, and videos.
- Admin analytics and dashboard endpoints.
- Workout recommendation engine based on user goals, BMI, and activity.
- Admin portal frontend under `frontend/admin-app`.

## Repository structure

```text
merged-backend-phase 3/
├── docs/                     # documentation and design notes
├── frontend/                 # admin portal source
│   └── admin-app/            # Vite + React admin app
├── prisma/                   # Prisma schema, migrations, and seed scripts
├── src/                      # backend source code
├── uploads/                  # local storage for uploaded media
├── .env.example              # environment variable template
├── package.json              # backend package configuration
├── README.md                 # this file
└── start.ps1                 # local launch script for Windows
```

## Key features

- Authentication and JWT-based session management
- Role-based access control for `USER`, `COACH`, and `ADMIN`
- User profile, coach management, appointment booking, and workout tracking
- Real-time chat and message delivery across user and coach participants
- Notification feed, device token registration, and push dispatch support
- Content CMS for posts, categories, and published content
- Admin analytics and reporting endpoints
- Swagger API documentation and Postman collection

## Prerequisites

- Node.js 18 or later
- npm
- PostgreSQL

## Setup (one-time)

1. Copy environment configuration:

```bash
cp .env.example .env
```

2. Update `.env` with the correct `DATABASE_URL`, JWT secret, Firebase credentials, and AWS keys.

3. Install backend dependencies:

```bash
npm install
```

4. Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

5. (Optional) Seed the database:

```bash
node prisma/seed.js
```

## Running the backend

**Development mode** (auto-restarts on file changes via nodemon):

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

The backend listens on the port defined in `.env`.

### Prisma & database utilities

```bash
npx prisma studio          # Open Prisma DB GUI in the browser
npx prisma migrate deploy  # Apply migrations in production
```

### Admin scripts

```bash
node scripts/create-admin.js   # Create an admin user
node scripts/check-admin.js    # Check admin status
```

## Running the admin portal

Open a second terminal and run:

```bash
cd frontend/admin-app
npm install
npm run dev
```

## Local launch script

On Windows PowerShell:

```powershell
./start.ps1
```

## API documentation

Swagger UI is available at:

- `http://localhost:4000/api-docs`

Use the Swagger documentation to explore the backend endpoints and request schemas.

## Useful commands

| Command | Description |
|---|---|
| `npm install` | Install all backend dependencies |
| `npm run dev` | Start backend in development mode (nodemon) |
| `npm start` | Start backend in production mode |
| `npm run lint` | Run ESLint against backend source files |
| `npx prisma generate` | Generate Prisma client |
| `npx prisma migrate dev` | Apply database migrations (development) |
| `npx prisma migrate deploy` | Apply database migrations (production) |
| `npx prisma studio` | Open Prisma DB GUI in browser |
| `node prisma/seed.js` | Seed the database |
| `node scripts/create-admin.js` | Create an admin user |
| `node scripts/check-admin.js` | Check admin user status |

## Notes

- The admin portal frontend is located in `frontend/admin-app` and runs independently from the backend.
- Ensure `.env` is not committed; use `.env.example` as the template.
- If Firebase push notifications are enabled, configure the `FCM_SERVICE_ACCOUNT_BASE64` environment variable.
- The root backend project includes `eslint`, but root-level lint configuration may need review or extension for your preferred style rules.

## Contact

For implementation details or support, review the source code in `src/` and the referenced Postman collection in `postman/FitNerve-Phase3.postman_collection.json`.
