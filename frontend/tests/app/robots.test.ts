import { afterEach, describe, expect, it, vi } from "vitest"
import robots from "@/app/robots"

afterEach((): void => {
  vi.unstubAllEnvs()
})

describe("robots", () => {
  it("keeps crawlers out of the API and the logged-in area in every locale", () => {
    vi.stubEnv("SITE_URL", "https://example.com")
    const result = robots()
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules
    expect(rules?.disallow).toEqual(expect.arrayContaining(["/api/", "/items", "/ru/items", "/en/admin"]))
    expect(result.sitemap).toBe("https://example.com/sitemap.xml")
  })
})
