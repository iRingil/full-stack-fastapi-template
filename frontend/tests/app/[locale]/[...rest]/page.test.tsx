import { notFound } from "next/navigation"
import { describe, expect, it } from "vitest"
import CatchAll from "@/app/[locale]/[...rest]/page"

describe("CatchAll", () => {
  it("answers 404", () => {
    CatchAll()
    expect(notFound).toHaveBeenCalled()
  })
})
