import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"

export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto w-full max-w-6xl p-6 print:hidden"
    >
      <PageHeaderSkeleton />
      <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed bg-muted/10">
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted/70" />
      </div>
    </div>
  )
}
