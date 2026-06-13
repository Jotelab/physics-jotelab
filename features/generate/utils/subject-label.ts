import type { Subject } from "@/features/generate/types"

type SubjectTranslator = (key: `subjects.${Subject}`) => string

export function getSubjectLabel(subject: Subject, t: SubjectTranslator) {
  return t(`subjects.${subject}`)
}
