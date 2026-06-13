import { generateWorksheetQuestion } from "../lib/ai/generate-question"

async function main() {
  console.log("Testing worksheet question generation...")
  console.log(
    "GOOGLE_GENERATIVE_AI_API_KEY:",
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "set" : "not set (will use AI Gateway)"
  )

  try {
    const question = await generateWorksheetQuestion({
      subject: "math",
      lesson: "Linear equations",
      scenario: "Solve a linear equation for the unknown variable x.",
      previousQuestionsContext: [],
    })

    console.log("Success:")
    console.log(JSON.stringify(question, null, 2))
  } catch (error) {
    console.error("Failed:")
    console.error(error)
    process.exit(1)
  }
}

main()
