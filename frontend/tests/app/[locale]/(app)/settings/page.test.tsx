import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import SettingsPage, { generateMetadata } from "@/app/[locale]/(app)/settings/page"
import { SettingsView } from "@/components/UserSettings/SettingsView"

describe("SettingsPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata()
    expect(metadata.title).toBe("Settings")
  })

  it("renders the SettingsView", async () => {
    const element = (await SettingsPage()) as ReactElement
    expect(element.type).toBe(SettingsView)
  })
})
