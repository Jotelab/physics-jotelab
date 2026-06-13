export type WorksheetGenerationRequestedEvent = {
  name: "worksheet/generation.requested"
  data: {
    jobId: string
    worksheetId: string
    profileId: string
  }
}
