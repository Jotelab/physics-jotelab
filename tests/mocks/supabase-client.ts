import { vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Builds the narrow `SupabaseClient` stand-in the generation-core specs need.
 *
 * Those cores only ever touch two shapes:
 *   - `from(table).select().eq().single()`  → a single row
 *   - `from(table).select().eq().order()`   → an ordered list
 * plus `rpc(name, args)`.
 *
 * The real client carries ~23 more members (`auth`, `realtime`, `storage`, the
 * protected `supabaseUrl`, …) that no spec exercises, so the mock cannot
 * structurally satisfy the type. The `as unknown as SupabaseClient` cast is
 * therefore deliberate — but it lives here, once, instead of being re-derived
 * (or silently omitted, which is what broke `tsc --noEmit`) at every call site.
 */

/** Terminal mocks for the query chain a spec wires up per table. */
export type TableQueryMocks = {
  /** Resolves `select().eq().single()`. */
  single?: () => unknown
  /** Resolves `select().eq().order()`. */
  order?: () => unknown
}

export function createSupabaseClientMock(options: {
  /** Terminal mocks keyed by table name; an unlisted table throws. */
  tables: Record<string, TableQueryMocks>
  /** Backs `supabase.rpc(...)`. */
  rpc: (...args: never[]) => unknown
}): SupabaseClient {
  const client = {
    from: vi.fn((table: string) => {
      const mocks = options.tables[table]

      if (!mocks) {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            ...(mocks.single ? { single: mocks.single } : {}),
            ...(mocks.order ? { order: mocks.order } : {}),
          })),
        })),
      }
    }),
    rpc: options.rpc,
  }

  return client as unknown as SupabaseClient
}
