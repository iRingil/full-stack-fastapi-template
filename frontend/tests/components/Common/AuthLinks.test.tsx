import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AuthLinks } from "@/components/Common/AuthLinks"
import { mockApi, renderWithProviders } from "../../testUtils"

describe("AuthLinks", () => {
  it("offers a guest to log in or sign up", async () => {
    mockApi({ "GET /api/auth/session": { authenticated: false } })
    renderWithProviders(<AuthLinks />)

    expect(await screen.findByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login")
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup")
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument()
  })

  it("leads a logged-in user to the dashboard instead", async () => {
    mockApi({ "GET /api/auth/session": { authenticated: true } })
    renderWithProviders(<AuthLinks />)

    expect(await screen.findByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard")
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument()
  })

  it("shows nothing until the answer comes", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise<Response>((): void => undefined))
    const { container } = renderWithProviders(<AuthLinks />)
    expect(container).toBeEmptyDOMElement()
  })
})
