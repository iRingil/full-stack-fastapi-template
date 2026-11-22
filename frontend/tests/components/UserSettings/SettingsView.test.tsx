import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { SettingsView } from "@/components/UserSettings/SettingsView"
import { mockApi, REGULAR_USER, renderWithProviders, SUPERUSER } from "../../testUtils"

describe("SettingsView", () => {
  it("offers a regular user all tabs and switches between them", async () => {
    mockApi({ "GET /api/v1/users/me": REGULAR_USER })
    renderWithProviders(<SettingsView />)

    expect(await screen.findByRole("tab", { name: "Danger zone" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "My profile" })).toHaveAttribute("aria-selected", "true")
    await userEvent.click(screen.getByRole("tab", { name: "Password" }))
    expect(screen.getByLabelText(/^current password/i)).toBeInTheDocument()
  })

  it("hides the danger zone from a superuser, who cannot delete themself", async () => {
    mockApi({ "GET /api/v1/users/me": SUPERUSER })
    renderWithProviders(<SettingsView />)

    await screen.findByDisplayValue("Ada Admin")
    expect(screen.queryByRole("tab", { name: "Danger zone" })).not.toBeInTheDocument()
  })
})
