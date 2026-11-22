import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { ThemeProvider } from "next-themes"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Appearance } from "@/components/UserSettings/Appearance"
import messages from "../../../messages/en.json"
import { renderWithProviders } from "../../testUtils"

describe("Appearance", () => {
  it("shows the stored theme and switches it", async () => {
    renderWithProviders(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Appearance />
      </ThemeProvider>,
    )

    expect(await screen.findByRole("radio", { name: "As in the system" })).toBeChecked()
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }))
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked()
    expect(document.documentElement).toHaveClass("dark")
  })

  it("falls back to the system theme when none is stored", async () => {
    // Without a provider next-themes reports no theme at all
    renderWithProviders(<Appearance />)
    expect(await screen.findByRole("radio", { name: "As in the system" })).toBeChecked()
  })

  it("is disabled with nothing chosen on the server, where the theme is unknown", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <Appearance />
      </NextIntlClientProvider>,
    )
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain("checked")
  })
})
