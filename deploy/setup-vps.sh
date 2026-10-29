#!/usr/bin/env bash
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo "Run as root" >&2; exit 1; }

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx ufw

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' "$VERSION_CODENAME" "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/docker.sources
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker nginx

# Preserve SSH access before enabling the firewall. SSH rules for common ports;
# custom SSH ports must be opened manually before running this setup.
ufw allow OpenSSH || true
# Host Nginx owns public 80/443 and proxies this hostname to 127.0.0.1:8088.
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "VPS base setup complete. Ensure DNS A record api-fitnerve.kwiko.org points to this server."
echo "SMTP uses outbound TCP submission (usually 587 or 465); never expose those as inbound listeners."
