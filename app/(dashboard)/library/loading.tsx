import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"

export default function LibraryLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6 print:hidden">
      <PageHeaderSkeleton titleWidth="w-28" descriptionWidth="w-80" />
      <div
        aria-busy="true"
        aria-label="Loading library"
        className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="aspect-[1/1.414] animate-pulse rounded-xl border bg-muted/40"
          />
        ))}
      </div>
    </div>
  )
}
