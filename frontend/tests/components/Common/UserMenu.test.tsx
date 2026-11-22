import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { initials, UserMenu } from "@/components/Common/UserMenu"
import { calls, mockApi, REGULAR_USER, renderWithProviders, router, SUPERUSER } from "../../testUtils"

describe("initials", () => {
  it("takes the first letters of up to two words", () => {
    expect(initials("ada lovelace", "a@example.com")).toBe("AL")
    expect(initials("Jean Luc Picard", "j@example.com")).toBe("JL")
  })

  it("falls back to the email without a name", () => {
    expect(initials(null, "zed@example.com")).toBe("Z")
    expect(initials("   ", "zed@example.com")).toBe("Z")
  })
})

describe("UserMenu", () => {
  it("renders nothing until the user is loaded", () => {
    mockApi({ "GET /api/v1/users/me": () => new Promise<Response>(() => undefined) })
    const { container } = renderWithProviders(<UserMenu />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the user and opens the settings", async () => {
    mockApi({ "GET /api/v1/users/me": SUPERUSER })
    renderWithProviders(<UserMenu />)

    const button = await screen.findByRole("button", { name: "User menu" })
    expect(button).toHaveTextContent("AAAda Admin")
    await userEvent.click(button)
    await userEvent.click(await screen.findByRole("menuitem", { name: "My profile" }))
    expect(router.push).toHaveBeenCalledWith("/settings")
  })

  it("logs out", async () => {
    const fetch = mockApi({
      "GET /api/v1/users/me": REGULAR_USER,
      "POST /api/auth/logout": () => new Response(null, { status: 204 }),
    })
    renderWithProviders(<UserMenu />)

    const button = await screen.findByRole("button", { name: "User menu" })
    expect(button).toHaveTextContent("Uuser@example.com")
    await userEvent.click(button)
    await userEvent.click(await screen.findByRole("menuitem", { name: "Log out" }))

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"))
    expect(calls(fetch)).toContain("POST /api/auth/logout")
  })
})
