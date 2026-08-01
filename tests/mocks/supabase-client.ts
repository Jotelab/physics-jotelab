import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Narrow a hand-built Supabase stub to `SupabaseClient` for a test call site.
 *
 * `SupabaseClient` has two dozen members (`auth`, `realtime`, `storage`, …) and
 * the code under test touches only `from` and `rpc`. Implementing the rest to
 * satisfy the compiler would be pages of noise that assert nothing, so the cast
 * is deliberate and lives here — named, commented, and in one place — rather
 * than being repeated inline at every call site.
 *
 * The safety this gives up is real but bounded: if production code starts using
 * a client member the stub lacks, the test fails at runtime with a clear
 * `undefined is not a function` rather than at compile time.
 */
export function asSupabaseClient(stub: unknown): SupabaseClient {
  return stub as SupabaseClient
}
