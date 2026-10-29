#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${FITNERVE_DIR:-$APP_DIR}"
BRANCH="${FITNERVE_BRANCH:-suhas-changes-3}"
COMPOSE=(docker compose --project-directory "$APP_DIR" --env-file "$APP_DIR/.env.deploy" -f "$APP_DIR/docker-compose.prod.yml")

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

if [[ "${1:-}" == "--help" ]]; then
  cat <<'HELP'
FitNerve VPS deploy (backend repository only)
  Checkout:      /opt/fitnerve
  First install: create /opt/fitnerve/.env.deploy and /opt/fitnerve/.env.production,
                 then run /opt/fitnerve/deploy.sh
  Update:        cd /opt/fitnerve && ./deploy.sh
  Logs:          docker compose --env-file .env.deploy -f docker-compose.prod.yml logs -f

Environment overrides: FITNERVE_DIR, FITNERVE_BRANCH.
The script updates the backend branch and does
not delete volumes or run a destructive Docker prune.
HELP
  exit 0
fi

[[ $EUID -eq 0 ]] || fail "Run as root (sudo)."
command -v docker >/dev/null || fail "Docker is not installed. Follow DEPLOYMENT.md first."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 plugin is required."
[[ -d "$APP_DIR/.git" ]] || fail "Expected backend Git checkout at $APP_DIR"
[[ -f "$APP_DIR/.env.deploy" ]] || fail "Missing $APP_DIR/.env.deploy"
[[ -f "$APP_DIR/.env.production" ]] || fail "Missing $APP_DIR/.env.production"
cd "$APP_DIR"

grep -q '^POSTGRES_DB=.' "$APP_DIR/.env.deploy" || fail "Set POSTGRES_DB in .env.deploy"
grep -q '^POSTGRES_USER=.' "$APP_DIR/.env.deploy" || fail "Set POSTGRES_USER in .env.deploy"
grep -q '^POSTGRES_PASSWORD=.' "$APP_DIR/.env.deploy" || fail "Set POSTGRES_PASSWORD in .env.deploy"
for name in JWT_ACCESS_SECRET JWT_REFRESH_SECRET SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS EMAIL_FROM CORS_ALLOWED_ORIGINS; do
  grep -Eq "^${name}=.+" "$APP_DIR/.env.production" || fail "Set ${name} in .env.production"
done
grep -q '^NODE_ENV=production$' "$APP_DIR/.env.production" || fail "NODE_ENV must be production"
if grep -Eq '^OTP_BYPASS_CODE=.+|^DATABASE_URL=.*localhost|^DATABASE_URL=.*127\.0\.0\.1' "$APP_DIR/.env.production"; then
  fail "Remove OTP bypass and use the internal postgres service in DATABASE_URL"
fi
if ! grep -Eq '^DATABASE_URL=postgres(ql)?://[^:]+:[^@]+@postgres:5432/' "$APP_DIR/.env.production"; then
  fail "DATABASE_URL must point to the internal postgres:5432 service"
fi

chmod 600 "$APP_DIR/.env.deploy" "$APP_DIR/.env.production"

printf 'Updating backend branch %s...\n' "$BRANCH"
git -C "$APP_DIR" fetch origin "$BRANCH"
git -C "$APP_DIR" checkout "$BRANCH"
git -C "$APP_DIR" pull --ff-only origin "$BRANCH"

"${COMPOSE[@]}" config --quiet

printf 'Building and starting PostgreSQL, API and Nginx...\n'
"${COMPOSE[@]}" up -d --build --remove-orphans

printf 'Applying Prisma migrations...\n'
"${COMPOSE[@]}" exec -T backend npx prisma migrate deploy

printf 'Checking API health...\n'
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:8088/api/v1/health >/dev/null; then
    printf 'FitNerve API is healthy at http://127.0.0.1:8088/api/v1/health (public TLS: https://api-fitnerve.kwiko.org)\n'
    exit 0
  fi
  sleep 2
done
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail=100 backend
fail "Deployment started, but health check did not pass."
