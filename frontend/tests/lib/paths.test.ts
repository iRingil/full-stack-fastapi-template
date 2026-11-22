import { describe, expect, it } from "vitest"
import { DASHBOARD_PATH, matchesPath, safeRedirectPath } from "@/lib/paths"

describe("matchesPath", () => {
  it("matches the page and its sub-pages only", () => {
    expect(matchesPath("/items", ["/items"])).toBe(true)
    expect(matchesPath("/items/42", ["/items"])).toBe(true)
    expect(matchesPath("/itemsx", ["/items"])).toBe(false)
    expect(matchesPath("/", ["/items", "/admin"])).toBe(false)
  })
})

describe("safeRedirectPath", () => {
  it("keeps a local path with its query", () => {
    expect(safeRedirectPath("/items?page=2")).toBe("/items?page=2")
  })

  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "items"])(
    "falls back to the dashboard for %j",
    (from) => {
      expect(safeRedirectPath(from)).toBe(DASHBOARD_PATH)
    },
  )
})
