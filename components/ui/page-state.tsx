import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function PageState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-h-72 items-center justify-center p-6", className)}>
      <div className="w-full max-w-md rounded-md border bg-background p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  )
}
