import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { LocaleSwitch } from "@/components/Common/LocaleSwitch"
import { navigation, renderWithProviders, router } from "../../testUtils"

/** Opens the menu and picks Russian. */
async function switchToRussian(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "Language" }))
  await userEvent.click(await screen.findByRole("menuitemradio", { name: "Русский" }))
}

describe("LocaleSwitch", () => {
  it("shows the current language and keeps the page and its query", async () => {
    navigation.pathname = "/items"
    navigation.searchParams = new URLSearchParams("page=2")
    renderWithProviders(<LocaleSwitch />)

    expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent("en")
    await switchToRussian()
    expect(router.replace).toHaveBeenCalledWith("/items?page=2", { locale: "ru" })
  })

  it("switches a page without a query", async () => {
    navigation.pathname = "/login"
    renderWithProviders(<LocaleSwitch />)

    await switchToRussian()
    expect(router.replace).toHaveBeenCalledWith("/login", { locale: "ru" })
  })
})
