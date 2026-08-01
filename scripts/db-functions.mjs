#!/usr/bin/env node
/**
 * Keeps `supabase/functions/*.sql` — the canonical source for every Postgres
 * function — in sync with what the migrations actually produce.
 *
 * Why generation rather than `\i` includes: `supabase db push` / `supabase
 * start` execute each migration over a Postgres driver, not through psql, so
 * backslash meta-commands (`\i`, `\ir`) are a syntax error there. Migrations
 * must stay self-contained plain SQL. So instead of including the canonical
 * file at apply time, we *emit* it into the migration at authoring time and
 * verify the two never diverge.
 *
 *   check  Replay every migration in order, compute each function's effective
 *          definition, and diff it against the canonical file. Drift fails.
 *   sync   Rewrite the canonical files from the migrations (bootstrap, and the
 *          fix-up after you hand-write a migration).
 *   emit   Print a function's canonical body, for pasting into a new migration.
 */

import { mkdir, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  FUNCTIONS_DIR,
  buildEffectiveFunctions,
  canonicalFileName,
  readCanonicalFunctions,
} from "./lib/db-functions.mjs"

const HEADER = `-- GENERATED FILE — do not edit by hand.
--
-- Canonical definition, reconstructed from the migration history by
-- \`pnpm run db:functions:sync\`. Migrations remain the source of truth for the
-- database; this file is the source of truth for *review* — it is what lets you
-- diff two versions of a function instead of two 300-line migration pastes.
--
-- To change this function: write a migration containing the new definition,
-- then re-run the sync. \`pnpm run db:functions:check\` fails if the two drift.
`

function relative(file) {
  return path.relative(process.cwd(), file).replace(/\\/g, "/")
}

async function loadBoth() {
  const effective = await buildEffectiveFunctions()
  const canonical = await readCanonicalFunctions()
  return { effective, canonical }
}

async function sync() {
  const effective = await buildEffectiveFunctions()
  const entries = [...effective.values()]

  await mkdir(FUNCTIONS_DIR, { recursive: true })

  // Clear stale files so a dropped function does not linger as canonical.
  for (const file of await readdir(FUNCTIONS_DIR).catch(() => [])) {
    if (file.endsWith(".sql")) {
      await rm(path.join(FUNCTIONS_DIR, file))
    }
  }

  const written = []

  for (const entry of entries) {
    const file = canonicalFileName(entry, entries)
    const provenance =
      entry.definitions > 1
        ? `-- Last changed by: ${entry.migration}\n-- Redefined ${entry.definitions}x across: ${entry.migrations.join(", ")}\n`
        : `-- Last changed by: ${entry.migration}\n`

    await writeFile(
      path.join(FUNCTIONS_DIR, file),
      `${HEADER}${provenance}\n${entry.body}`,
      "utf8"
    )
    written.push(file)
  }

  console.log(`Wrote ${written.length} canonical function files to ${relative(FUNCTIONS_DIR)}/`)
  return 0
}

async function check() {
  const { effective, canonical } = await loadBoth()

  const missing = []
  const drifted = []
  const orphaned = []

  for (const [signature, entry] of effective) {
    const match = canonical.get(signature)
    if (!match) {
      missing.push(signature)
      continue
    }
    if (match.body.trim() !== entry.body.trim()) {
      drifted.push({ signature, file: match.file, migration: entry.migration })
    }
  }

  for (const signature of canonical.keys()) {
    if (!effective.has(signature)) orphaned.push(signature)
  }

  if (missing.length === 0 && drifted.length === 0 && orphaned.length === 0) {
    console.log(
      `db:functions check OK — ${effective.size} functions match their canonical source.`
    )
  } else {
    if (missing.length > 0) {
      console.error(
        `\n${missing.length} function(s) defined in migrations have no canonical file:`
      )
      for (const signature of missing) console.error(`  - ${signature}`)
    }

    if (drifted.length > 0) {
      console.error(`\n${drifted.length} canonical file(s) drifted from the migrations:`)
      for (const { signature, file, migration } of drifted) {
        console.error(
          `  - ${signature}\n      canonical: ${relative(path.join(FUNCTIONS_DIR, file))}\n      migration: ${migration}`
        )
      }
    }

    if (orphaned.length > 0) {
      console.error(
        `\n${orphaned.length} canonical file(s) describe functions no migration defines:`
      )
      for (const signature of orphaned) console.error(`  - ${signature}`)
    }

    console.error(`\nRun \`pnpm run db:functions:sync\` to reconcile.`)
    return 1
  }

  // Advisory: duplicate live overloads are the failure mode this whole workflow
  // exists to catch. Adding a parameter with `create or replace` silently
  // leaves the old arity behind — it already happened once with
  // `update_generation_job_progress` (cleaned up in migration 20260625000000).
  const byName = new Map()
  for (const entry of effective.values()) {
    byName.set(entry.name, [...(byName.get(entry.name) ?? []), entry])
  }

  const overloaded = [...byName.entries()].filter(([, list]) => list.length > 1)

  if (overloaded.length > 0) {
    console.warn(`\nwarning: ${overloaded.length} function name(s) have multiple live overloads.`)
    console.warn(`If an arity is a leftover from adding a parameter, drop it explicitly.`)
    for (const [name, list] of overloaded) {
      console.warn(`  ${name}`)
      for (const entry of list) {
        console.warn(`    - (${entry.argTypes.join(", ")})  from ${entry.migration}`)
      }
    }
  }

  return 0
}

async function emit(signatureQuery) {
  const { effective } = await loadBoth()

  const matches = [...effective.values()].filter(
    (entry) =>
      entry.signature === signatureQuery ||
      entry.name === signatureQuery ||
      entry.name === `public.${signatureQuery}`
  )

  if (matches.length === 0) {
    console.error(`No function matches "${signatureQuery}".`)
    return 1
  }

  if (matches.length > 1) {
    console.error(`"${signatureQuery}" is overloaded — name one signature:`)
    for (const entry of matches) console.error(`  - ${entry.signature}`)
    return 1
  }

  process.stdout.write(matches[0].body)
  return 0
}

async function main() {
  const [command, ...args] = process.argv.slice(2)

  switch (command) {
    case "check":
      return check()
    case "sync":
      return sync()
    case "emit":
      if (!args[0]) {
        console.error("usage: db-functions emit <function-name-or-signature>")
        return 1
      }
      return emit(args[0])
    default:
      console.error("usage: db-functions <check|sync|emit>")
      return 1
  }
}

process.exitCode = await main()
