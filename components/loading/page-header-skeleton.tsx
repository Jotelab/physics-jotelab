import { cn } from "@/lib/utils"

export function PageHeaderSkeleton({
  titleWidth = "w-36",
  descriptionWidth = "w-64",
}: {
  titleWidth?: string
  descriptionWidth?: string
}) {
  return (
    <div className="mb-6">
      <div className={cn("h-7 animate-pulse rounded-md bg-muted", titleWidth)} />
      <div className={cn("mt-3 h-4 animate-pulse rounded-md bg-muted/70", descriptionWidth)} />
    </div>
  )
}
