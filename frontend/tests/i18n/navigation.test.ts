import { describe, expect, it, vi } from "vitest"

describe("navigation", () => {
  it("builds locale-aware paths: no prefix for the default locale", async () => {
    // The module is mocked for components in setupTests; here the real one is checked
    const { getPathname } = await vi.importActual<typeof import("@/i18n/navigation")>("@/i18n/navigation")
    expect(getPathname({ href: "/login", locale: "en" })).toBe("/login")
    expect(getPathname({ href: "/login", locale: "ru" })).toBe("/ru/login")
  })
})
