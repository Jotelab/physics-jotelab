import { createHash } from "node:crypto"

import type { VariantLabel } from "../types"

// Fixed namespace for worksheet-variant identity. Generated once; never change
// it, or previously persisted variant ids would no longer be reproducible.
const VARIANT_NAMESPACE = "6f9b8e2a-7c3d-4f1e-9a2b-1c5d4e3f2a10"

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex")
}

/**
 * Deterministically derive a variant's id from its job + label.
 *
 * The variant worker runs inside Inngest, which replays the function body on
 * every step boundary. Minting the id with `crypto.randomUUID()` in the body
 * produced a fresh id on each replay, so the id persisted by the per-roll step
 * could drift from the one written at finalize. A name-based (UUIDv5) id is
 * stable across replays and retries for a given `(jobId, label)` pair.
 */
export function deriveVariantId(jobId: string, label: VariantLabel): string {
  const hash = createHash("sha1")
  hash.update(uuidToBytes(VARIANT_NAMESPACE))
  hash.update(`${jobId}:${label}`)
  const bytes = hash.digest()

  bytes[6] = (bytes[6] & 0x0f) | 0x50 // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant

  const hex = bytes.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
