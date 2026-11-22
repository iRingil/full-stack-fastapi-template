import { describe, expect, it } from "vitest"
import { initials } from "@/components/Common/UserMenu"

describe("initials", () => {
  it("takes the first letters of up to two words", () => {
    expect(initials("ada lovelace", "a@example.com")).toBe("AL")
    expect(initials("Jean Luc Picard", "j@example.com")).toBe("JL")
  })

  it("falls back to the email without a name", () => {
    expect(initials(null, "zed@example.com")).toBe("Z")
    expect(initials("   ", "zed@example.com")).toBe("Z")
  })
})
