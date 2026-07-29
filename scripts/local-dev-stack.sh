#!/usr/bin/env bash
#
# Boot a fully LOCAL stack — Docker Supabase + test user + .env.local — so the
# whole app (login included) runs with no cloud project, no Google OAuth, and
# no AI keys (generation is stubbed via E2E_STUB_GENERATION).
#
# Prereqs (one-time installs, the only sudo steps):
#   docker            e.g. Arch: sudo pacman -S docker && sudo systemctl enable --now docker
#   supabase CLI      https://supabase.com/docs/guides/local-development (binary release works)
#
# Usage:            bash scripts/local-dev-stack.sh
# Then:             npm run dev   →  http://localhost:3000/login
# Sign in with the credentials this script prints (password form on the login page).
#
# How to test: after `npm run dev`, /login shows "Dev sign-in (local Supabase)";
# signing in lands on /generate. `supabase stop` shuts the stack down.
# If the schema looks stale after pulling new migrations: `supabase db reset`.

set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI is not installed or not on PATH (see header for install)" >&2
  exit 1
fi

if ! supabase status >/dev/null 2>&1; then
  echo "Starting local Supabase (first run downloads images and applies migrations)…"
  supabase start
fi

# Reuse the CI helper: emits NEXT_PUBLIC_SUPABASE_URL / keys / test-user creds.
env_lines="$(bash scripts/ci-supabase-e2e-env.sh)"
eval "$env_lines"

# Create (or keep) the local test user via the GoTrue admin API.
create_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${E2E_TEST_USER_EMAIL}\",\"password\":\"${E2E_TEST_USER_PASSWORD}\",\"email_confirm\":true}")
case "$create_response" in
  200|201) echo "Test user created: ${E2E_TEST_USER_EMAIL}" ;;
  422)     echo "Test user already exists: ${E2E_TEST_USER_EMAIL}" ;;
  *)       echo "Could not create test user (HTTP ${create_response})" >&2; exit 1 ;;
esac

# Local Postgres differs from hosted Supabase in two ways that break the app
# (missing default table grants; octet_length(jsonb) does not resolve) —
# apply the idempotent fixes in supabase/local-fixes.sql. Re-run this script
# after any `supabase db reset`.
db_container=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
if [[ -n "$db_container" ]]; then
  docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    < supabase/local-fixes.sql >/dev/null
  echo "Applied supabase/local-fixes.sql (grants + jsonb size-check casts)"
else
  echo "WARNING: could not find the supabase_db container to apply local-fixes.sql" >&2
fi

if [[ -f .env.local ]]; then
  cp .env.local ".env.local.bak.$(date +%s)"
  echo "Backed up existing .env.local"
fi

cat > .env.local <<EOF
# Written by scripts/local-dev-stack.sh — fully local, no cloud services.
${env_lines}
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Password form on /login for the local test user (never set in production).
DEV_PASSWORD_LOGIN=true

# Stubbed generation: worksheets/coach work with no AI keys and no engine.
# For real engine problems run jotelab-ai locally and set ENGINE_BASE_URL /
# ENGINE_API_KEY here instead of the stub flag.
E2E_STUB_GENERATION=true
GENERATION_MODE=neuro_symbolic
EOF

echo
echo "✔ .env.local written. Start the app with: npm run dev"
echo "  Sign in at http://localhost:3000/login with:"
echo "    email:    ${E2E_TEST_USER_EMAIL}"
echo "    password: ${E2E_TEST_USER_PASSWORD}"
