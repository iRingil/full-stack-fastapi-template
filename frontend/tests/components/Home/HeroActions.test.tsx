import { QueryClient } from "@tanstack/react-query"
import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HeroActions } from "@/components/Home/HeroActions"
import { mockApi, renderWithProviders } from "../../testUtils"

describe("HeroActions", () => {
  it("offers a guest the dashboard and a new account", async () => {
    mockApi({ "GET /api/auth/session": { authenticated: false } })
    renderWithProviders(<HeroActions />)

    expect(await screen.findByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup")
    expect(screen.getByRole("link", { name: "Open the dashboard" })).toHaveAttribute("href", "/dashboard")
  })

  it("offers a logged-in user only the dashboard", async () => {
    mockApi({ "GET /api/auth/session": { authenticated: true } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderWithProviders(<HeroActions />, queryClient)

    await waitFor(() => expect(queryClient.getQueryData(["session"])).toBe(true))
    expect(screen.getByRole("link", { name: "Open the dashboard" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Create an account" })).not.toBeInTheDocument()
  })
})
