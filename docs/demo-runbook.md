# Demo runbook — NSC 2026 on-site judging

The single question this runbook answers: **can a judge, on a machine that has
never logged in, open the production URL and generate a real worksheet
end-to-end?** Work through it top to bottom before every demo day.

The production stack has four moving parts, and generation dies if any one is
missing. Verify all four — three of them are env-var checks on Vercel:

| # | Part | Where | Dies without it |
|---|------|-------|-----------------|
| 1 | Symbolic engine service | Render (`jotelab-ai` repo, `render.yaml`) | Engine lessons: every slot skips with ENGINE_UNAVAILABLE |
| 2 | `ENGINE_BASE_URL` + `ENGINE_API_KEY` | Vercel env | Same as above |
| 3 | `GOOGLE_GENERATIVE_AI_API_KEY` (or AI Gateway OIDC) | Vercel env | Every generation fails at the phrasing step |
| 4 | `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` + registered Inngest app | Vercel env + Inngest dashboard | Generate button errors immediately: "Background generation is not configured" |

## 1. Deploy the engine (Render)

The Docker artifact is verified: it honours Render's injected `$PORT`, serves
an unauthenticated `/health`, and 401s `/generate` without the shared key.

1. Render dashboard → **New → Blueprint** → pick the `Jotelab/jotelab-ai` repo.
   `render.yaml` at the repo root defines the `jotelab-engine` web service and
   generates `ENGINE_API_KEY` on first deploy.
2. After the first deploy, copy from the Render dashboard:
   - the service URL (e.g. `https://jotelab-engine-XXXX.onrender.com`)
   - the generated `ENGINE_API_KEY` env value.

**How to test**

```bash
ENGINE_URL="https://<your-service>.onrender.com"
ENGINE_KEY="<the generated key>"

curl -s "$ENGINE_URL/health"          # expect {"status":"ok","topics":[...11 topics]}
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$ENGINE_URL/generate" \
  -H 'Content-Type: application/json' -d '{"topic":"suvat","difficulty":"easy"}'
                                      # expect 401 (no key)
curl -s -X POST "$ENGINE_URL/generate" \
  -H 'Content-Type: application/json' -H "X-Engine-Api-Key: $ENGINE_KEY" \
  -d '{"topic":"suvat","difficulty":"easy","given":["u","a","t"],"find":"v","seed":42}'
                                      # expect exact rationals; seed 42 gives v = 9 m/s
```

The same three checks pass against the local image
(`docker build -t jotelab-engine . && docker run -e ENGINE_API_KEY=dev -e PORT=10000 -p 18080:10000 jotelab-engine`,
then use `http://127.0.0.1:18080`).

## 2. Point the web app at it (Vercel)

Vercel project → Settings → Environment Variables (Production):

```
ENGINE_BASE_URL = https://<your-service>.onrender.com
ENGINE_API_KEY  = <the same generated key>
GENERATION_MODE = neuro_symbolic
```

Confirm `GOOGLE_GENERATIVE_AI_API_KEY` (or the AI Gateway OIDC setup) is
present, and that `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` are set with the
app registered in the Inngest dashboard (Apps → the Vercel URL `/api/inngest`
endpoint must show as synced). Redeploy so the env takes effect.

**How to test** — the judge dry-run, from a clean browser profile:

1. Open `https://physics-jotelab.vercel.app`, log in.
2. `/generate` → lesson "Motion in one dimension" → any scenario → Generate.
3. Every question renders with numbers and a diagram; no slot shows an error.
4. **Export PDF** and open the download.
5. Record the transcript (screenshots or screen recording) — that transcript
   is the P0 exit criterion.

## 3. Outage behaviour (must stay legible)

If the engine is unreachable the user must see the localized
ENGINE_UNAVAILABLE message — Thai:
"ไม่สามารถเชื่อมต่อกับเอนจินคำนวณได้ในขณะนี้ ระบบได้คืนเครดิตให้แล้ว กรุณาลองใหม่อีกครั้ง" —
and every reserved credit must come back. Never the raw
"Could not reach the symbolic engine: fetch failed".

**How to test** — automated drill against a dead engine (local Supabase must be
running; no Google key needed — the engine fails before the LLM is called):

```bash
set -a; source .env.local; set +a
E2E_ENGINE_OUTAGE=true E2E_STUB_GENERATION=false GENERATION_INLINE=true \
ENGINE_BASE_URL=http://127.0.0.1:59999 ENGINE_API_KEY=dead-key \
npx playwright test --project=setup --project=engine-outage
# expect: 2 passed — asserts the Thai copy, no leaked internals, balance restored
```

To rehearse it in production: temporarily suspend the Render service, run one
generation, confirm the Thai message + refund, resume the service.

## 4. Day-of checklist

- [ ] `curl $ENGINE_URL/health` returns ok (Render free/starter instances can
      cold-start — hit it before the judges do).
- [ ] One full generate → PDF cycle on production within the last hour.
- [ ] Credit balance of the demo account is comfortably above 10 × planned runs.
- [ ] Backup: local stack (`bash scripts/local-dev-stack.sh && npm run dev`)
      with the engine container running, in case the venue network is hostile.
