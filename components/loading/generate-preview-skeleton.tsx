export function GeneratePreviewSkeleton() {
  return (
    <section className="flex min-h-[50vh] min-w-0 flex-1 flex-col bg-muted/30 md:min-h-[60vh] lg:min-h-0">
      <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b bg-background px-4 py-3 md:px-6">
        <div className="h-5 w-40 animate-pulse rounded-md bg-muted/70" />
        <div className="flex gap-2">
          <div className="h-14 w-28 animate-pulse rounded-xl bg-muted/40 lg:h-8 lg:w-24 lg:rounded-lg" />
          <div className="h-14 w-36 animate-pulse rounded-xl bg-muted/40 lg:h-8 lg:w-32 lg:rounded-lg" />
        </div>
      </div>
      <div className="flex flex-1 items-start justify-center p-4 sm:p-6 lg:p-8">
        <div className="aspect-[210/297] w-full max-w-[210mm] animate-pulse rounded-sm bg-muted/50 shadow-sm ring-1 ring-border" />
      </div>
    </section>
  )
}
