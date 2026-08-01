import { z } from "zod"

import { MAX_TIKZ_CODE_LEN } from "@/features/generate/limits"
import { compileTikz, TikzCompileError } from "@/lib/tikz/compile"
import { createClient } from "@/lib/supabase/server"

/**
 * Authenticated TikZ → SVG compile endpoint.
 *
 * Wraps {@link compileTikz} so the generation flow (Phase 2.2) and manual
 * previews can turn `tikz_code` into a self-contained `diagram_svg`. Runs in the
 * Node runtime because the compiler uses a WASM TeX engine + `fs`. Gated on an
 * authenticated session and a hard length cap; running a TeX engine on request
 * input is expensive, so rate-limiting is a follow-up before this is opened up
 * beyond the signed-in app.
 */
export const runtime = "nodejs"

const requestSchema = z.object({
  tikz_code: z.string().min(1).max(MAX_TIKZ_CODE_LEN),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED" }, { status: 422 })
  }

  try {
    const diagramSvg = await compileTikz(parsed.data.tikz_code)
    return Response.json({ diagram_svg: diagramSvg })
  } catch (error) {
    if (error instanceof TikzCompileError) {
      return Response.json(
        { error: "COMPILE_FAILED", detail: error.message },
        { status: 422 }
      )
    }

    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
