import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import GlobalNotFound from "@/app/not-found"

describe("GlobalNotFound", () => {
  it("renders a whole English 404 document", () => {
    const html = renderToStaticMarkup(GlobalNotFound() as ReactElement)
    expect(html).toContain('<html lang="en">')
    expect(html).toContain("Page not found")
    expect(html).toContain('href="/"')
  })
})
