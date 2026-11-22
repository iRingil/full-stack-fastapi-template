import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ThemeProvider } from "next-themes"
import { describe, expect, it } from "vitest"
import { ThemeSwitch } from "@/components/Common/ThemeSwitch"
import { renderWithProviders } from "../../testUtils"

describe("ThemeSwitch", () => {
  it("toggles between the light and the dark theme", async () => {
    renderWithProviders(
      <ThemeProvider attribute="class" defaultTheme="light">
        <ThemeSwitch />
      </ThemeProvider>,
    )

    await userEvent.click(await screen.findByRole("button", { name: "Switch to the dark theme" }))
    expect(document.documentElement).toHaveClass("dark")
    await userEvent.click(screen.getByRole("button", { name: "Switch to the light theme" }))
    expect(document.documentElement).toHaveClass("light")
  })
})
