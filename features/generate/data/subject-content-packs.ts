import type { SubjectContentPack } from "@/features/generate/data/content-pack"
import { physicsContentPack } from "@/features/generate/data/content-packs/physics"
import { DEFAULT_SUBJECT } from "@/features/generate/schemas"
import type { Subject } from "@/features/generate/types"

// One content pack per supported subject. Adding a subject to `SUBJECTS`
// (features/generate/schemas.ts) makes this map a type error until its pack is
// registered here — that is the intended single extension point.
export const SUBJECT_CONTENT_PACKS: Record<Subject, SubjectContentPack> = {
  physics: physicsContentPack,
}

export function getSubjectContentPack(
  subject: Subject = DEFAULT_SUBJECT
): SubjectContentPack {
  return SUBJECT_CONTENT_PACKS[subject] ?? SUBJECT_CONTENT_PACKS[DEFAULT_SUBJECT]
}
