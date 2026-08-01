#!/usr/bin/env node
/**
 * Ground-truth check for `supabase/functions/*.sql`.
 *
 * `db-functions check` compares canonical files against migrations using our
 * own SQL scanner — so it can only prove the scanner is self-consistent. This
 * script proves the stronger thing: it applies every migration to a real
 * Postgres and asks the *server* what functions exist, then compares that to
 * the canonical set.
 *
 * It runs a throwaway container on an ephemeral port rather than
 * `supabase start`, so it never collides with a Supabase project you already
 * have running.
 *
 * Not part of `pnpm run check` — it needs Docker and takes ~30s. Run it after
 * changing the scanner or when you want to trust the canonical set absolutely.
 */

import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import {
  MIGRATIONS_DIR,
  buildEffectiveFunctions,
  listMigrations,
} from "./lib/db-functions.mjs"

const run = promisify(execFile)

const CONTAINER = "physics-jotelab-fnverify"
const IMAGE = "postgres:17-alpine"
const PASSWORD = "verify"

/** Roles and the auth surface the migrations expect Supabase to provide. */
const BOOTSTRAP = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

create or replace function auth.uid() returns uuid
language sql stable as $fn$ select null::uuid $fn$;

create or replace function auth.jwt() returns jsonb
language sql stable as $fn$ select '{}'::jsonb $fn$;
`

async function docker(args, options = {}) {
  return run("docker", args, { maxBuffer: 64 * 1024 * 1024, ...options })
}

async function psql(sql, { quiet = true } = {}) {
  const args = [
    "exec",
    "-i",
    "-e",
    `PGPASSWORD=${PASSWORD}`,
    CONTAINER,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ]
  if (quiet) args.push("-q", "-t", "-A")

  const child = execFile("docker", args, { maxBuffer: 64 * 1024 * 1024 })
  child.stdin.end(sql)

  return new Promise((resolve, reject) => {
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => (stdout += chunk))
    child.stderr.on("data", (chunk) => (stderr += chunk))
    child.on("error", reject)
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `psql exited ${code}`))
      else resolve(stdout)
    })
  })
}

async function waitForReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await docker(["exec", CONTAINER, "pg_isready", "-U", "postgres", "-q"])
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  throw new Error("Postgres did not become ready in 60s")
}

async function teardown() {
  await docker(["rm", "-f", CONTAINER]).catch(() => {})
}

async function main() {
  await teardown()

  console.log(`Starting throwaway ${IMAGE} (no host port bound)...`)
  await docker([
    "run",
    "-d",
    "--name",
    CONTAINER,
    "-e",
    `POSTGRES_PASSWORD=${PASSWORD}`,
    IMAGE,
  ])

  await waitForReady()

  console.log("Bootstrapping Supabase roles + auth surface...")
  await psql(BOOTSTRAP)

  const migrations = await listMigrations()
  console.log(`Applying ${migrations.length} migrations...`)

  for (const migration of migrations) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, migration), "utf8")
    try {
      await psql(sql)
    } catch (error) {
      console.error(`\nFAILED applying ${migration}:\n${error.message}`)
      throw error
    }
  }

  // Ask the server which functions exist. Build the signature from
  // `proargtypes` — the IN-parameter types, which is exactly what Postgres
  // overloads on. `pg_get_function_identity_arguments` would also include
  // parameter *names*, which are not part of a function's identity.
  const rows = await psql(`
    select
      n.nspname || '.' || p.proname
      || '(' || coalesce(
           (select string_agg(format_type(t, null), ', ' order by ord)
              from unnest(p.proargtypes) with ordinality as a(t, ord)),
           ''
         ) || ')'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    order by 1;
  `)

  const live = new Set(
    rows
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  )

  const effective = await buildEffectiveFunctions()

  // Our parser records declared argument types; Postgres reports identity
  // arguments (types only, defaults and names stripped). Normalize both.
  // Both sides name the same types slightly differently: our parser keeps the
  // source spelling (`public.credit_reservations`, `text[]`), format_type
  // renders the catalog's (`credit_reservations`, `text[]`). Reduce both to a
  // common form before comparing.
  const normalize = (signature) =>
    signature
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/character varying/g, "varchar")
      // Applied to both sides, so dropping every occurrence (including the
      // function's own schema prefix) keeps equal things equal.
      .replace(/\bpublic\./g, "")
      .trim()

  const parsed = new Set([...effective.keys()].map(normalize))
  const server = new Set([...live].map(normalize))

  const missingFromParser = [...server].filter((s) => !parsed.has(s))
  const extraInParser = [...parsed].filter((s) => !server.has(s))

  console.log(`\nServer reports ${server.size} public functions.`)
  console.log(`Canonical set has ${parsed.size}.`)

  if (missingFromParser.length === 0 && extraInParser.length === 0) {
    console.log("\nMATCH — the canonical set is exactly what Postgres ends up with.")
    return 0
  }

  if (missingFromParser.length > 0) {
    console.error(`\n${missingFromParser.length} function(s) exist in Postgres but not in the canonical set:`)
    for (const signature of missingFromParser) console.error(`  - ${signature}`)
  }

  if (extraInParser.length > 0) {
    console.error(`\n${extraInParser.length} function(s) in the canonical set do not exist in Postgres:`)
    for (const signature of extraInParser) console.error(`  - ${signature}`)
  }

  return 1
}

try {
  process.exitCode = await main()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await teardown()
}
