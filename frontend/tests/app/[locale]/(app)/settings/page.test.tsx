import { setRequestLocale } from "next-intl/server"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import SettingsPage, { generateMetadata } from "@/app/[locale]/(app)/settings/page"
import { SettingsView } from "@/components/UserSettings/SettingsView"

const params = { params: Promise.resolve({ locale: "ru" }) }

describe("SettingsPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata(params)
    expect(metadata.title).toBe("Settings")
  })

  it("renders the SettingsView in the requested locale", async () => {
    const element = (await SettingsPage(params)) as ReactElement
    expect(element.type).toBe(SettingsView)
    expect(setRequestLocale).toHaveBeenCalledWith("ru")
  })
})
