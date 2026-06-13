import { headers } from "next/headers"

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "https://physics-jotelab.vercel.app",
])

function isAllowedOrigin(origin: string) {
  return ALLOWED_ORIGINS.has(origin)
}

function originFromHost(host: string, proto: string | null) {
  const hostname = host.split(",")[0]?.trim()
  if (!hostname) {
    return null
  }

  const protocol =
    proto?.split(",")[0]?.trim() ??
    (hostname.includes("localhost") || hostname.startsWith("127.0.0.1")
      ? "http"
      : "https")

  return `${protocol}://${hostname}`
}

export async function getRequestOrigin(): Promise<string | null> {
  const headerStore = await headers()

  const origin = headerStore.get("origin")
  if (origin && isAllowedOrigin(origin)) {
    return origin
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  if (host) {
    const computed = originFromHost(host, headerStore.get("x-forwarded-proto"))
    if (computed && isAllowedOrigin(computed)) {
      return computed
    }
  }

  const referer = headerStore.get("referer")
  if (referer) {
    try {
      const computed = new URL(referer).origin
      if (isAllowedOrigin(computed)) {
        return computed
      }
    } catch {
      // Ignore invalid referer values.
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl && isAllowedOrigin(siteUrl)) {
    return siteUrl
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000"
  }

  return null
}
