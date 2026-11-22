import { describe, expect, it } from "vitest"
import LocaleNotFound from "@/app/[locale]/not-found"
import { NotFound } from "@/components/Common/NotFound"

describe("LocaleNotFound", () => {
  it("renders the localized 404", () => {
    expect(LocaleNotFound()).toEqual(<NotFound />)
  })
})
