export default function LibraryWorksheetLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading worksheet"
      className="flex min-h-0 flex-1 flex-col print:hidden"
    >
      <div className="border-b bg-background px-6 py-3">
        <div className="h-14 w-40 animate-pulse rounded-xl bg-muted/40 lg:h-8 lg:w-36 lg:rounded-lg" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-muted/30 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex w-full max-w-[210mm] flex-1 items-start justify-center">
          <div className="aspect-[210/297] w-full animate-pulse rounded-sm bg-muted/50 shadow-sm ring-1 ring-border" />
        </div>
      </div>
    </div>
  )
}
