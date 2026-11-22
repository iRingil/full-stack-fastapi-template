import { setRequestLocale } from "next-intl/server"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import DashboardPage, { generateMetadata } from "@/app/[locale]/(app)/dashboard/page"
import { DashboardView } from "@/components/Dashboard/DashboardView"

const params = { params: Promise.resolve({ locale: "ru" }) }

describe("DashboardPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata(params)
    expect(metadata.title).toBe("Dashboard")
  })

  it("renders the DashboardView in the requested locale", async () => {
    const element = (await DashboardPage(params)) as ReactElement
    expect(element.type).toBe(DashboardView)
    expect(setRequestLocale).toHaveBeenCalledWith("ru")
  })
})
