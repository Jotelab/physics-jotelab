#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI is not installed or not on PATH" >&2
  exit 1
fi

if ! supabase status >/dev/null 2>&1; then
  echo "Local Supabase is not running. Start it with: supabase start" >&2
  exit 1
fi

eval "$(supabase status -o env)"

required_vars=(API_URL ANON_KEY SERVICE_ROLE_KEY JWT_SECRET)
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing $var from supabase status -o env" >&2
    exit 1
  fi
done

cat <<EOF
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SUPABASE_JWT_SECRET=${JWT_SECRET}
E2E_TEST_USER_EMAIL=e2e@test.jotelab.local
E2E_TEST_USER_PASSWORD=ci-e2e-password
EOF
