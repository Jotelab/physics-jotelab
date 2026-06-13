import { pageSubtitleClass, pageTitleClass } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description?: string
  className?: string
}

export function PageHeader({ title, description, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <h1 className={pageTitleClass}>{title}</h1>
      {description ? <p className={pageSubtitleClass}>{description}</p> : null}
    </div>
  )
}
