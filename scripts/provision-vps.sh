#!/usr/bin/env bash
# NutriOS — Hostinger VPS provisioning (Ubuntu 22.04 LTS)
# Idempotent: safe to re-run. Target: ~/srv/nutrios on the VPS.
#
# Usage (on the VPS as root or sudo):
#   curl -fsSL https://raw.githubusercontent.com/<user>/nutrios/main/scripts/provision-vps.sh | sudo bash
# or:
#   sudo bash scripts/provision-vps.sh
#
# Requirements exposed via environment:
#   DOMAIN               api.nutrios.mx
#   LETSENCRYPT_EMAIL    ops@nutrios.mx
#   POSTGRES_APP_PASS    <strong random>
#   REDIS_PASS           <strong random>

set -euo pipefail

: "${DOMAIN:?DOMAIN must be set (e.g. api.nutrios.mx)}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL must be set}"
: "${POSTGRES_APP_PASS:?POSTGRES_APP_PASS must be set}"
: "${REDIS_PASS:?REDIS_PASS must be set}"

log() { printf '\n→ %s\n' "$*"; }

log 'Updating APT and installing base packages'
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release ufw nginx certbot \
    python3-certbot-nginx git build-essential

log 'Installing Node.js 20 LTS via NodeSource'
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

log 'Installing pnpm + PM2 globally'
npm install -g pnpm@10 pm2

log 'Installing PostgreSQL 17 via official PGDG'
if ! command -v psql >/dev/null 2>&1 || ! psql --version | grep -q ' 17'; then
    install -d /usr/share/postgresql-common/pgdg
    curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
        --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
    sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    apt-get update -y
    apt-get install -y postgresql-17
fi
systemctl enable --now postgresql

log 'Installing Redis 7'
apt-get install -y redis-server
sed -i "s/^# requirepass .*/requirepass ${REDIS_PASS}/" /etc/redis/redis.conf || true
sed -i "s/^requirepass .*/requirepass ${REDIS_PASS}/" /etc/redis/redis.conf || true
sed -i 's/^appendonly no/appendonly yes/' /etc/redis/redis.conf || true
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf || true
systemctl enable --now redis-server
systemctl restart redis-server

log 'Creating PostgreSQL roles and database (idempotent)'
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nutrios') THEN
    CREATE ROLE nutrios LOGIN SUPERUSER PASSWORD 'nutrios_dev_replace_me';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nutrios_app') THEN
    CREATE ROLE nutrios_app LOGIN PASSWORD '${POSTGRES_APP_PASS}' NOBYPASSRLS;
  ELSE
    ALTER ROLE nutrios_app PASSWORD '${POSTGRES_APP_PASS}';
  END IF;
END\$\$;

SELECT 'CREATE DATABASE nutrios_prod OWNER nutrios'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nutrios_prod')\gexec
SQL

log 'Firewall: allow SSH (22), HTTP (80), HTTPS (443) only'
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "Creating Nginx reverse-proxy config for ${DOMAIN}"
cat >/etc/nginx/sites-available/nutrios-api <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/nutrios-api /etc/nginx/sites-enabled/nutrios-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log 'Requesting Let\'s Encrypt certificate'
certbot --nginx --non-interactive --agree-tos -m "${LETSENCRYPT_EMAIL}" -d "${DOMAIN}" || \
    echo 'certbot failed — verify DNS points to this host and rerun manually'

log 'Creating deploy user + /srv/nutrios'
id -u deploy >/dev/null 2>&1 || useradd -m -s /bin/bash deploy
install -d -o deploy -g deploy /srv/nutrios

log 'Done. Next steps:'
cat <<EOF
  1. Switch to deploy user: sudo -iu deploy
  2. Clone repo:            git clone https://github.com/<user>/nutrios.git /srv/nutrios/api
  3. cp apps/api/.env.example apps/api/.env   (fill with prod secrets)
  4. pnpm install --frozen-lockfile
  5. pnpm --filter @nutrios/db exec prisma migrate deploy
  6. pnpm --filter @nutrios/api build
  7. pm2 start dist/main.js --name nutrios-api --cwd apps/api
  8. pm2 save && pm2 startup systemd
EOF
