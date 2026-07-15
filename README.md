# FitNerve Backend — Phase 1

Production-grade Node.js/Express/PostgreSQL/Prisma backend covering Phase 1 scope: **Authentication, User Profile, Coach Module, and Image Uploads.**

Full design specifications can be found in [`FitNerve_Phase1_Documentation.md`](./FitNerve_Phase1_Documentation.md).

## Folder Structure

```
backend/
├── src/
│   ├── config/         # env.js, logger.js (Winston configuration)
│   ├── constants/      # roles.js, httpStatus.js
│   ├── controllers/    # auth, user, coach, upload controllers
│   ├── services/       # business logic layers per module
│   ├── repositories/   # Prisma query repository layer (isolated from services)
│   ├── routes/v1/      # versioned route definitions + JSDoc OpenAPI specs
│   ├── middlewares/    # auth checks, rate limiters, validation, error handling
│   ├── validators/     # Zod schema definitions
│   ├── utils/          # ApiError, ApiResponse, jwt, storage helper
│   ├── database/       # Prisma client initializer singleton
│   ├── app.js          # Express app configuration
│   └── server.js       # App entry point
├── prisma/             # Schema definition
├── postman/            # Postman integration collection
└── .env.example
```

## 1. Prerequisites

- Node.js ≥ 18
- Running PostgreSQL database (e.g., Supabase PostgreSQL)

## 2. Environment Variables & Setup

Create a `.env` file in the root of the backend folder:

```bash
cp .env.example .env
```

Define the configuration keys:
- **`DATABASE_URL`**: Use the standard session mode pooler (e.g. port `5432`) for Prisma CLI schema pushes and migrations.
  - *Example*: `postgresql://postgres.zrbcjqjqtreuadxkzeht:PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`
- **`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`**: Strong random hex strings.

## 3. Database Synchronization

Since the schema uses Supabase, always connect to the session pooler (port `5432`) to sync tables. Run the following commands:

```bash
# Push the local schema.prisma directly to the database
npx prisma db push

# Generate the Prisma client code
npx prisma generate
```

> **Note**: If `npx prisma generate` fails with an `EPERM` error, stop your Express development server (`npm run dev`) first to unlock the Prisma query engine binary in memory, then run the command again.

## 4. Run Server

```bash
# Start development server with Nodemon auto-reloads
npm run dev

# Start production server
npm start
```

- **API Base URL**: `http://localhost:4000/api/v1`
- **Swagger Documentation UI**: `http://localhost:4000/api-docs`
- **API Health Check Endpoint**: `GET http://localhost:4000/api/v1/health`

## 5. Password Security & Validation Rules

When registering a new user account, the backend validates passwords with Zod using these criteria:
- Minimum of **8 characters**
- Contains at least one **uppercase letter** (`A-Z`)
- Contains at least one **lowercase letter`** (`a-z`)
- Contains at least one **number** (`0-9`)

## 6. Postman Integration

Import the file `postman/FitNerve-Phase1.postman_collection.json` into Postman. After running **Register** or **Login**, a post-request script automatically captures the tokens and configures variables for all subsequent authenticated endpoints (like `GET /users/me`).
