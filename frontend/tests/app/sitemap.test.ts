import { afterEach, describe, expect, it, vi } from "vitest"
import sitemap from "@/app/sitemap"

afterEach((): void => {
  vi.unstubAllEnvs()
})

describe("sitemap", () => {
  it("lists the public pages with their language versions", () => {
    vi.stubEnv("SITE_URL", "https://example.com")
    const entries = sitemap()
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://example.com/",
      "https://example.com/login",
      "https://example.com/signup",
      "https://example.com/recover-password",
    ])
    expect(Object.keys(entries[0]?.alternates?.languages ?? {})).toEqual(["en", "ru"])
  })
})
