import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  parseDropFunctionStatement,
  parseFunctionStatement,
  splitStatements,
} from "./parse-sql-functions.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = path.resolve(here, "..", "..")
export const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations")

/**
 * Canonical function sources.
 *
 * Deliberately NOT `supabase/functions/` — the CLI reserves that path for Edge
 * Functions (`supabase functions deploy|serve`, and the local edge-runtime
 * container, which `config.toml` has enabled). Dropping `.sql` files there
 * would put us in the way of that tooling.
 */
export const FUNCTIONS_DIR = path.join(REPO_ROOT, "supabase", "sql", "functions")

/** Migration filenames in application order (the timestamp prefix sorts). */
export async function listMigrations() {
  const entries = await readdir(MIGRATIONS_DIR)
  return entries.filter((name) => name.endsWith(".sql")).sort()
}

/**
 * Replays every migration in order and returns the *effective* schema: the last
 * definition to win for each function signature, which is what a fresh
 * `supabase start` actually ends up with.
 *
 * Keyed by signature (name + argument types) rather than name, because Postgres
 * overloads on arguments — `update_generation_job_progress` shipped a 6-arg and
 * a 7-arg version simultaneously before one was dropped.
 */
export async function buildEffectiveFunctions() {
  const migrations = await listMigrations()

  /** signature -> { signature, name, body, migration, redefinitions } */
  const effective = new Map()

  for (const migration of migrations) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, migration), "utf8")

    for (const statement of splitStatements(sql)) {
      const dropped = parseDropFunctionStatement(statement.text)
      if (dropped) {
        effective.delete(dropped.signature)
        continue
      }

      const parsed = parseFunctionStatement(statement.text)
      if (!parsed) continue

      const previous = effective.get(parsed.signature)

      effective.set(parsed.signature, {
        ...parsed,
        // Byte-for-byte the definition the database will run, so a canonical
        // file is a faithful copy rather than a reformatting.
        body: `${parsed.definition}\n`,
        migration,
        // Definitions since the signature was last dropped — i.e. how many
        // times this exact body was re-pasted to change it in place.
        definitions: (previous?.definitions ?? 0) + 1,
        migrations: [...(previous?.migrations ?? []), migration],
      })
    }
  }

  return effective
}

/**
 * Canonical filename for a signature. Overloads get an arity suffix so two live
 * versions of one name cannot collide on disk.
 */
export function canonicalFileName(entry, allEntries) {
  const bare = entry.name.replace(/^public\./, "")
  const overloaded =
    allEntries.filter((other) => other.name === entry.name).length > 1

  return overloaded
    ? `${bare}__${entry.argTypes.length}.sql`
    : `${bare}.sql`
}

/** Reads the canonical function sources currently on disk. */
export async function readCanonicalFunctions() {
  let entries = []
  try {
    entries = await readdir(FUNCTIONS_DIR)
  } catch (error) {
    if (error.code === "ENOENT") return new Map()
    throw error
  }

  const canonical = new Map()

  for (const file of entries.filter((name) => name.endsWith(".sql")).sort()) {
    const sql = await readFile(path.join(FUNCTIONS_DIR, file), "utf8")

    for (const statement of splitStatements(sql)) {
      const parsed = parseFunctionStatement(statement.text)
      if (!parsed) continue

      canonical.set(parsed.signature, {
        ...parsed,
        body: `${parsed.definition}\n`,
        file,
      })
    }
  }

  return canonical
}
