"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const worksheetIdSchema = z.string().uuid()

export async function deleteWorksheetAction(formData: FormData) {
  const worksheetId = formData.get("worksheetId")
  const parsed = worksheetIdSchema.safeParse(worksheetId)

  if (!parsed.success) {
    throw new Error("Invalid worksheet id")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be logged in to delete worksheets.")
  }

  const { error } = await supabase
    .from("worksheets")
    .delete()
    .eq("id", parsed.data)

  if (error) {
    throw new Error("Could not delete worksheet")
  }

  revalidatePath("/library")
}
