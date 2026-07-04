import "server-only"

import { Inngest } from "inngest"

const isProduction = process.env.NODE_ENV === "production"
const signingKey = process.env.INNGEST_SIGNING_KEY

// `next build` imports this module while collecting page data (NODE_ENV is
// "production" then), so exempt the build phase — the signing key only needs to
// be present when the endpoint is actually served, not when it's compiled.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build"

// Fail fast at boot rather than serving an unverified endpoint: without a signing
// key, Inngest can fall back to dev mode and skip request-signature verification,
// which would let anyone POST to /api/inngest to mint user-scoped JWTs and spend
// credits. Pin `signingKey`/`isDev` on the client explicitly instead of trusting
// env auto-detection.
if (isProduction && !isBuildPhase && !signingKey) {
  throw new Error(
    "INNGEST_SIGNING_KEY is required in production; refusing to serve /api/inngest without request-signature verification."
  )
}

// App-level id, not a per-subject value. Overridable via env so a deployment can
// use a subject-neutral id; the default preserves the existing registered app id
// (changing it registers a new Inngest app and orphans in-flight functions).
export const inngest = new Inngest({
  id: process.env.INNGEST_APP_ID ?? "physics-jotelab",
  signingKey,
  isDev: !isProduction,
})
