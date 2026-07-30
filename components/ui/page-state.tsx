import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function PageState({
  title,
  description,
  action,
  illustration,
  className,
}: {
  title: string
  description: string
  action?: ReactNode
  illustration?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-h-72 items-center justify-center p-6", className)}>
      <div className="w-full max-w-md rounded-md border bg-background p-6 text-center shadow-sm">
        {illustration ? (
          <div className="mb-4 flex justify-center print:hidden">{illustration}</div>
        ) : null}
        <h1 className="font-heading text-lg font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  )
}
