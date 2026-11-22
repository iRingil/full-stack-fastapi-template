import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import AppLayout, { metadata } from "@/app/[locale]/(app)/layout"
import { AppShell } from "@/components/Common/AppShell"

describe("AppLayout", () => {
  it("keeps the logged-in area out of search engines", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it("frames the page with the app shell", () => {
    const element = AppLayout({ children: <p>page</p> }) as ReactElement
    expect(element.type).toBe(AppShell)
  })
})
