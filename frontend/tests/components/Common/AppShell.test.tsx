import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AppShell } from "@/components/Common/AppShell"
import { mockApi, navigation, REGULAR_USER, renderWithProviders, router, SUPERUSER } from "../../testUtils"

describe("AppShell", () => {
  it("frames the page with the navigation, the current page highlighted", async () => {
    navigation.pathname = "/items"
    mockApi({ "GET /api/v1/users/me": SUPERUSER })
    renderWithProviders(
      <AppShell>
        <p>page</p>
      </AppShell>,
    )

    expect(screen.getByRole("main")).toHaveTextContent("page")
    const nav = screen.getByRole("navigation", { name: "Main navigation" })
    expect(await within(nav).findByRole("link", { name: "Admin" })).toBeInTheDocument()
    expect(within(nav).getByRole("link", { name: "Items" })).toHaveAttribute("aria-current", "page")
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current")
    expect(within(nav).getByRole("link", { name: "Home page" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Full Stack FastAPI" })).toHaveAttribute("href", "/")
  })

  it("hides the admin page from a regular user", async () => {
    mockApi({ "GET /api/v1/users/me": REGULAR_USER })
    renderWithProviders(<AppShell>page</AppShell>)

    await screen.findByRole("button", { name: "User menu" })
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument()
  })

  it("opens the navigation in a drawer on small screens and closes it after a click", async () => {
    mockApi({ "GET /api/v1/users/me": REGULAR_USER })
    renderWithProviders(<AppShell>page</AppShell>)

    await userEvent.click(screen.getByRole("button", { name: "Open the menu" }))
    const drawer = await screen.findByRole("dialog")
    await userEvent.click(within(drawer).getByRole("link", { name: "Settings" }))

    expect(router.push).toHaveBeenCalledWith("/settings")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })
})
