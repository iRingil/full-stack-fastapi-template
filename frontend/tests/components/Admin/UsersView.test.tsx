import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { UserPublic } from "@/client/types.gen"
import { UsersView } from "@/components/Admin/UsersView"
import { jsonResponse, renderWithProviders } from "../../testUtils"

const ADMIN: UserPublic = {
  id: "a",
  email: "admin@example.com",
  full_name: "Admin",
  is_superuser: true,
  is_active: true,
}
const USER: UserPublic = { id: "u", email: "user@example.com", full_name: null, is_superuser: false, is_active: false }

/**
 * Mocks `/users/me` and `/users/`.
 * @param me - The logged-in user.
 * @returns The fetch spy.
 */
function mockBackend(me: UserPublic) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = new URL((input as Request).url).pathname
    if (path === "/api/v1/users/me") {
      return jsonResponse(me)
    }
    if (path === "/api/v1/users/") {
      return jsonResponse({ data: [ADMIN, USER], count: 2 })
    }
    return jsonResponse({ detail: "unexpected" }, 500)
  })
}

describe("UsersView", () => {
  it("lists the users for a superuser, marking the admin themself", async () => {
    mockBackend(ADMIN)
    renderWithProviders(<UsersView />)

    expect(await screen.findByText("user@example.com")).toBeInTheDocument()
    expect(screen.getByText("You")).toBeInTheDocument()
    expect(screen.getByText("Inactive")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Actions for admin@example.com" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Actions for user@example.com" })).toBeEnabled()
  })

  it("does not query the users for a non-superuser", async () => {
    const fetch = mockBackend(USER)
    renderWithProviders(<UsersView />)

    expect(await screen.findByText("No access")).toBeInTheDocument()
    const paths = fetch.mock.calls.map((call) => new URL((call[0] as Request).url).pathname)
    expect(paths).not.toContain("/api/v1/users/")
  })
})
