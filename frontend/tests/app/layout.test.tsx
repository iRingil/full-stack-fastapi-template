import { isValidElement } from "react"
import { describe, expect, it } from "vitest"
import RootLayout from "@/app/layout"

describe("RootLayout", () => {
  it("passes the children through", () => {
    const child = <p>page</p>
    expect(RootLayout({ children: child })).toBe(child)
    expect(isValidElement(child)).toBe(true)
  })
})
