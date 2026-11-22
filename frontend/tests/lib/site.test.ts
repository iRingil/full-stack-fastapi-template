import { afterEach, describe, expect, it, vi } from "vitest"
import { localeAlternates, localeOf, siteUrl } from "@/lib/site"

afterEach((): void => {
  vi.unstubAllEnvs()
})

describe("siteUrl", () => {
  it("reads SITE_URL, with the dev server as the default", () => {
    vi.stubEnv("SITE_URL", "https://example.com")
    expect(siteUrl().href).toBe("https://example.com/")
    vi.stubEnv("SITE_URL", undefined)
    expect(siteUrl().href).toBe("http://localhost:5173/")
  })
})

describe("localeOf", () => {
  it("keeps a known locale and falls back to the default one", async () => {
    expect(await localeOf(Promise.resolve({ locale: "ru" }))).toBe("ru")
    expect(await localeOf(Promise.resolve({ locale: "xx" }))).toBe("en")
  })
})

describe("localeAlternates", () => {
  it("links the page in every language", () => {
    // getPathname is mocked in setupTests to return the path as is
    expect(localeAlternates("/login", "ru")).toEqual({
      canonical: "/login",
      languages: { en: "/login", ru: "/login" },
    })
  })
})
