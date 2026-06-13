import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"

export default function AccountLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading account"
      className="mx-auto w-full max-w-3xl p-4 md:p-6 print:hidden"
    >
      <PageHeaderSkeleton titleWidth="w-32" descriptionWidth="w-72" />
      <div className="rounded-md border bg-background p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="size-16 shrink-0 animate-pulse rounded-full bg-muted/40" />
            <div className="space-y-2">
              <div className="h-5 w-36 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded-md bg-muted/70" />
            </div>
          </div>
          <div className="h-20 w-28 animate-pulse rounded-md border bg-muted/20" />
        </div>
        <div className="mt-6 h-8 w-24 animate-pulse rounded-lg bg-muted/40" />
      </div>
    </div>
  )
}
