# FitNerve VPS deployment (development environment)

This deploys the API and admin/coach web portals, PostgreSQL, and reverse proxy at
`https://api-fitnerve.kwiko.org`. It does not host the Expo user app SPA; that
needs its own web host/domain or native app build. PostgreSQL and the API are private to the Docker network. Nginx publishes
only loopback port 8088 (HTTP); host Nginx terminates TLS on public 443 and proxies to 127.0.0.1:8088.
PostgreSQL has no host port. Persistent named volumes hold PostgreSQL, uploads, and
logs. `deploy.sh` never deletes volumes or runs a Docker prune.
## 1. DNS and VPS

Create an `A` record `api-fitnerve.kwiko.org` pointing at the VPS public IPv4
(and an `AAAA` record only if IPv6 is configured end-to-end). Wait for DNS:

```bash
dig +short api-fitnerve.kwiko.org A
```

From the backend repository checkout, install Docker, Compose, Nginx, Certbot, and UFW:

```bash
sudo bash deploy/setup-vps.sh
```

If SSH runs on a nonstandard port, allow it in UFW before enabling the firewall.
The script opens inbound 22 (OpenSSH), 80, and 443 only. SMTP needs **outbound**
TCP to the provider on 587 (STARTTLS) or 465 (implicit TLS); it is not an inbound
VPS service and should not be published in Docker/UFW. Some VPS providers block
outbound SMTP. If the SMTP test fails at connect time, ask the provider to allow
outbound submission or use an email service/API that permits your use case.

## 2. Create protected environment files

Clone only the backend GitHub repository into `/opt/fitnerve`. Create the ignored
environment files there:

```bash
cd /opt/fitnerve
install -m 700 -d /opt/fitnerve
cat > .env.deploy <<'EOF'
POSTGRES_DB=fitnerve
POSTGRES_USER=fitnerve
POSTGRES_PASSWORD=REPLACE_WITH_A_LONG_RANDOM_PASSWORD
EOF
chmod 600 .env.deploy

cat > .env.production <<'EOF'
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
chmod 600 .env.production
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

## 3. Nginx and TLS

FitNerve binds only `127.0.0.1:8088`; Postgres has no host port. Check public listeners and install the supplied site as an additional host Nginx virtual host. Existing domains are left intact:

```bash
ss -ltnp | grep -E ':(80|443)\b' || true
install -m 644 deploy/nginx/host-api-fitnerve.conf /etc/nginx/sites-available/api-fitnerve.kwiko.org
ln -s /etc/nginx/sites-available/api-fitnerve.kwiko.org /etc/nginx/sites-enabled/api-fitnerve.kwiko.org
nginx -t && systemctl reload nginx
```

After the HTTP-only site is active and DNS points to the VPS, create the
certificate. Certbot adds the HTTPS server block to this site:

```bash
certbot --nginx -d api-fitnerve.kwiko.org --email YOUR_REAL_EMAIL --agree-tos --no-eff-email
nginx -t && systemctl reload nginx
```

Deploy and verify through both the internal loopback and public HTTPS routes:

```bash
cd /opt/fitnerve
./deploy.sh
curl -fsS http://127.0.0.1:8088/api/v1/health
curl -fsS https://api-fitnerve.kwiko.org/api/v1/health
```

Certbot's system timer handles renewals; verify with `certbot renew --dry-run`.
## 4. SMTP/OTP verification

The app sends email through Nodemailer using `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`. Port 587 uses STARTTLS; 465 uses TLS.
The VPS provider may need to lift outbound SMTP restrictions. Check connectivity
without printing credentials:

```bash
nc -vz smtp.your-provider.example 587
docker compose --project-directory . --env-file .env.deploy -f docker-compose.prod.yml logs --tail=100 backend
```

Register with a real test mailbox, inspect the message and enter the received
code. A successful API response alone is not proof of mailbox delivery.

## 5. Update deployment after a backend code change

Push the backend change to the configured backend branch. The deploy script
updates backend branch `suhas-changes-3` by default; override it if needed:

```bash
cd /opt/fitnerve
FITNERVE_BRANCH=suhas-changes-3 ./deploy.sh
```

Inspect status/logs and stop/start without removing persistent data:

```bash
docker compose --project-directory . --env-file .env.deploy -f docker-compose.prod.yml ps
docker compose --project-directory . --env-file .env.deploy -f docker-compose.prod.yml logs -f backend nginx postgres
docker compose --project-directory . --env-file .env.deploy -f docker-compose.prod.yml down
docker compose --project-directory . --env-file .env.deploy -f docker-compose.prod.yml up -d
```

`down` preserves named volumes. Do not use `down -v` unless intentionally
destroying the development database/uploads.

## 6. Push the backend repository

From the developer workstation, push only the backend repository for this VPS deployment:

```powershell
cd "D:\kwiko projects\FITNERVE\BACKEND"
git status --short
git push origin suhas-changes-3
```