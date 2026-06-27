import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }))

import { createServiceRoleClient } from "@/lib/supabase/admin"
import { runStaleGenerationSweep, STUCK_JOB_TTL_MINUTES } from "./run-stale-generation-sweep"

const mockAdminFactory = vi.mocked(createServiceRoleClient)

type RpcCall = { name: string; params: unknown }

function makeAdmin(impl: (name: string, params: unknown) => { data: unknown; error: unknown }) {
  const rpcCalls: RpcCall[] = []
  const admin = {
    rpc: vi.fn(async (name: string, params?: unknown) => {
      rpcCalls.push({ name, params })
      return impl(name, params)
    }),
  }
  return { admin, rpcCalls }
}

function recordingStep() {
  const names: string[] = []
  return {
    names,
    step: {
      run: async <T>(name: string, fn: () => Promise<T>) => {
        names.push(name)
        return fn()
      },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("runStaleGenerationSweep", () => {
  it("cleans expired reservations then reaps stuck jobs, returning the counts", async () => {
    const { admin, rpcCalls } = makeAdmin((name) =>
      name === "cleanup_expired_credit_reservations"
        ? { data: 3, error: null }
        : { data: 2, error: null }
    )
    mockAdminFactory.mockReturnValue(admin as never)

    const { step, names } = recordingStep()
    const result = await runStaleGenerationSweep(step)

    expect(result).toEqual({ reservationsCleaned: 3, jobsReaped: 2 })
    expect(names).toEqual(["cleanup-expired-reservations", "reap-stuck-jobs"])
    expect(rpcCalls).toContainEqual({ name: "cleanup_expired_credit_reservations", params: undefined })
    expect(rpcCalls).toContainEqual({
      name: "reap_stuck_generation_jobs",
      params: { p_older_than_minutes: STUCK_JOB_TTL_MINUTES },
    })
  })

  it("normalizes non-numeric rpc payloads to 0", async () => {
    const { admin } = makeAdmin(() => ({ data: null, error: null }))
    mockAdminFactory.mockReturnValue(admin as never)

    const { step } = recordingStep()

    expect(await runStaleGenerationSweep(step)).toEqual({ reservationsCleaned: 0, jobsReaped: 0 })
  })

  it("throws when a cleanup rpc errors", async () => {
    const { admin } = makeAdmin((name) =>
      name === "cleanup_expired_credit_reservations"
        ? { data: null, error: { message: "boom" } }
        : { data: 0, error: null }
    )
    mockAdminFactory.mockReturnValue(admin as never)

    const { step } = recordingStep()

    await expect(runStaleGenerationSweep(step)).rejects.toThrow("boom")
  })
})
