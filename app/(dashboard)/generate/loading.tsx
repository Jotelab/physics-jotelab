import { GeneratePreviewSkeleton } from "@/components/loading/generate-preview-skeleton"
import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"

export default function GenerateLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading generate workspace"
      className="flex min-h-0 flex-1 flex-col bg-background lg:flex-row lg:overflow-hidden print:hidden"
    >
      <section className="w-full shrink-0 border-b bg-background p-4 md:p-6 lg:w-[340px] lg:overflow-y-auto lg:border-r lg:border-b-0 xl:w-[400px] 2xl:w-[360px]">
        <PageHeaderSkeleton titleWidth="w-52" descriptionWidth="w-40" />
        <div className="mb-5 h-16 animate-pulse rounded-lg bg-muted/40 lg:h-12" />
        <div className="space-y-7">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded-md bg-muted/70" />
              <div className="h-14 animate-pulse rounded-xl bg-muted/40 lg:h-12 lg:rounded-lg" />
            </div>
          ))}
        </div>
        <div className="mt-8 space-y-3 border-t pt-5">
          <div className="h-4 w-full animate-pulse rounded-md bg-muted/70" />
          <div className="h-4 w-full animate-pulse rounded-md bg-muted/70" />
          <div className="h-14 animate-pulse rounded-xl bg-muted lg:h-12 lg:rounded-lg" />
        </div>
      </section>

      <GeneratePreviewSkeleton />
    </div>
  )
}
