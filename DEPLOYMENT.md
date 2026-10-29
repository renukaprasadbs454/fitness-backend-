# FitNerve VPS deployment (development environment)

This deploys the API, admin/coach web portals, PostgreSQL, and reverse proxy at
`https://api-fitnerve.kwiko.org`. It does not host the Expo user app SPA; that
needs its own web host/domain or native app build. PostgreSQL and the API are private to the Docker network; only Nginx
publishes ports 80/443. Persistent named volumes hold PostgreSQL, uploads, and
logs. `deploy.sh` never deletes volumes or runs a Docker prune.

## 1. DNS and VPS

Create an `A` record `api-fitnerve.kwiko.org` pointing at the VPS public IPv4
(and an `AAAA` record only if IPv6 is configured end-to-end). Wait for DNS:

```bash
dig +short api-fitnerve.kwiko.org A
```

From the project checkout, install Docker, Compose, Nginx, Certbot, and UFW:

```bash
sudo bash BACKEND/deploy/setup-vps.sh
```

If SSH runs on a nonstandard port, allow it in UFW before enabling the firewall.
The script opens inbound 22 (OpenSSH), 80, and 443 only. SMTP needs **outbound**
TCP to the provider on 587 (STARTTLS) or 465 (implicit TLS); it is not an inbound
VPS service and should not be published in Docker/UFW. Some VPS providers block
outbound SMTP. If the SMTP test fails at connect time, ask the provider to allow
outbound submission or use an email service/API that permits your use case.

## 2. Create protected environment files

Copy this workspace to `/opt/fitnerve`, with `BACKEND` and `FRONTEND` as sibling
directories and Git checkouts. Then create the two ignored secret files:

```bash
cd /opt/fitnerve
install -m 700 -d /opt/fitnerve
cat > .env.deploy <<'EOF'
POSTGRES_DB=fitnerve
POSTGRES_USER=fitnerve
POSTGRES_PASSWORD=REPLACE_WITH_A_LONG_RANDOM_PASSWORD
EOF
chmod 600 .env.deploy

cat > BACKEND/.env.production <<'EOF'
NODE_ENV=production
PORT=5050
API_VERSION=v1
DATABASE_URL=postgresql://fitnerve:REPLACE_WITH_URL_ENCODED_PASSWORD@postgres:5432/fitnerve?schema=public
JWT_ACCESS_SECRET=REPLACE_WITH_AT_LEAST_64_RANDOM_HEX_CHARACTERS
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=REPLACE_WITH_A_DIFFERENT_64_RANDOM_HEX_CHARACTERS
JWT_REFRESH_EXPIRES_IN=30d
REQUIRE_EMAIL_VERIFICATION=true
OTP_EXPIRES_MIN=10
OTP_MAX_ATTEMPTS=5
OTP_BYPASS_CODE=
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password-or-app-password
EMAIL_FROM=verified-sender@your-domain.example
SMTP_FROM_NAME=FitNerve
CORS_ALLOWED_ORIGINS=https://api-fitnerve.kwiko.org
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=uploads
ENABLE_CRON=true
LOG_LEVEL=info
EOF
chmod 600 BACKEND/.env.production
```

Generate distinct strong secrets with:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Use the first value for `POSTGRES_PASSWORD`, then URL-encode any reserved
characters in the password inside `DATABASE_URL` (or use a password consisting
of URL-safe letters and digits). Use separate values for the JWT secrets. SMTP
credentials must come from the mail provider; Gmail requires an app password
and an allowed sender. Never commit either env file. Production forcibly ignores
`OTP_BYPASS_CODE`; no fixed OTP is accepted. Failed or missing production SMTP
configuration returns an error instead of pretending an OTP was delivered.

## 3. Issue TLS certificate

For initial issuance, use the HTTP-only Nginx config and bind host HTTPS to
loopback temporarily so another service on the VPS cannot conflict:

```bash
cd /opt/fitnerve
mkdir -p BACKEND/deploy/certbot/www BACKEND/deploy/certbot/conf
FITNERVE_NGINX_CONF=./BACKEND/deploy/nginx/api-fitnerve.conf \
NGINX_HTTPS_BIND=127.0.0.1:8443 \
  docker compose --env-file .env.deploy \
  -f BACKEND/docker-compose.prod.yml up -d --build
```

Request the certificate via HTTP-01:

```bash
docker compose --env-file .env.deploy \
  -f BACKEND/docker-compose.prod.yml --profile certbot run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d api-fitnerve.kwiko.org \
  --email YOUR_REAL_EMAIL --agree-tos --no-eff-email
```

Switch to HTTPS Nginx and verify health:

```bash
sed -i 's#FITNERVE_NGINX_CONF=.*#FITNERVE_NGINX_CONF=./BACKEND/deploy/nginx/api-fitnerve-ssl.conf#' .env.deploy
sed -i 's#NGINX_HTTPS_BIND=.*#NGINX_HTTPS_BIND=0.0.0.0:443#' .env.deploy
docker compose --env-file .env.deploy \
  -f BACKEND/docker-compose.prod.yml up -d
curl -fsS https://api-fitnerve.kwiko.org/api/v1/health
```

`deploy.sh` uses the TLS config by default, applies Prisma migrations, rebuilds
services, and checks the public health endpoint through local Nginx on port 8088.
For later certificate renewal, run the same Certbot webroot command with
`renew`, then reload Nginx. Schedule it with a systemd timer/cron after checking
`certbot renew --dry-run`.

## 4. SMTP/OTP verification

The app sends email through Nodemailer using `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`. Port 587 uses STARTTLS; 465 uses TLS.
The VPS provider may need to lift outbound SMTP restrictions. Check connectivity
without printing credentials:

```bash
nc -vz smtp.your-provider.example 587
docker compose --env-file .env.deploy -f BACKEND/docker-compose.prod.yml logs --tail=100 backend
```

Register with a real test mailbox, inspect the message and enter the received
code. A successful API response alone is not proof of mailbox delivery.

## 5. Update deployment after a code change

Keep the backend and frontend changes pushed to their configured branches. The
backend deploy script updates backend branch `suhas-changes-3` and frontend
branch `main` by default; override either before running if your release branches
differ:

```bash
cd /opt/fitnerve
FITNERVE_BRANCH=suhas-changes-3 FITNERVE_FRONTEND_BRANCH=suhas-changes ./BACKEND/deploy.sh
```

Inspect status/logs and stop/start without removing persistent data:

```bash
docker compose --env-file .env.deploy -f BACKEND/docker-compose.prod.yml ps
docker compose --env-file .env.deploy -f BACKEND/docker-compose.prod.yml logs -f backend nginx postgres
docker compose --env-file .env.deploy -f BACKEND/docker-compose.prod.yml down
docker compose --env-file .env.deploy -f BACKEND/docker-compose.prod.yml up -d
```

`down` preserves named volumes. Do not use `down -v` unless intentionally
destroying the development database/uploads.

## 6. GitHub push from the developer workstation

This workspace currently has two independent repositories, not one root
repository. Push the backend and frontend changes in their respective repos;
deployment files in this guide currently live with the backend checkout. Stage
only reviewed paths, never `.env` files:

```powershell
cd "D:\kwiko projects\FITNERVE\BACKEND"
git status --short
git add src docker-compose.prod.yml docker-compose.nginx.yml deploy.sh deploy/ DEPLOYMENT.md Dockerfile
git commit -m "Add FitNerve VPS deployment and coach access controls"
git push origin suhas-changes-3

cd "D:\kwiko projects\FITNERVE\FRONTEND"
git status --short
git add Dockerfile nginx.conf src/screens/BookingScreen.tsx src/screens/CoachDetailScreen.tsx src/screens/VerifyOtpScreen.tsx src/store/appStore.ts
git commit -m "Enforce assigned coach booking and refresh sessions"
git push origin suhas-changes
```

If pushing a release to another branch, confirm the GitHub branch protections
and merge process first. Never force-push.
