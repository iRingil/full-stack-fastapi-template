import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import DashboardPage, { generateMetadata } from "@/app/[locale]/(app)/dashboard/page"
import { DashboardView } from "@/components/Dashboard/DashboardView"

describe("DashboardPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata()
    expect(metadata.title).toBe("Dashboard")
  })

  it("renders the DashboardView", async () => {
    const element = (await DashboardPage()) as ReactElement
    expect(element.type).toBe(DashboardView)
  })
})
