import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

import enMessages from "../messages/en.json"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock)

function createTranslator(namespace: string) {
  const messages = (enMessages as Record<string, Record<string, unknown>>)[namespace] ?? {}

  return (key: string, values?: Record<string, string | number>) => {
    const raw = messages[key]
    let message = typeof raw === "string" ? raw : key

    if (values) {
      for (const [placeholder, value] of Object.entries(values)) {
        message = message.replaceAll(`{${placeholder}}`, String(value))
      }
    }

    return message
  }
}

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "en"),
  getMessages: vi.fn(async () => enMessages),
  getTranslations: vi.fn(async (namespace: string) => createTranslator(namespace)),
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => createTranslator(namespace),
  useLocale: () => "en",
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

afterEach(() => {
  cleanup()
})
