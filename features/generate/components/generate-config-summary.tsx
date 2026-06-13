import { GraduationCap } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function GenerateConfigSummary() {
  const t = await getTranslations("generate")
  const tCommon = await getTranslations("common")

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <GraduationCap className="size-4" />
        {tCommon("generate")}
      </div>
      <h1 className="text-2xl font-semibold tracking-normal">{t("configureWorksheet")}</h1>
    </div>
  )
}
