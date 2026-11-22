import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { UserPublic } from "@/client/types.gen"
import { UsersView } from "@/components/Admin/UsersView"
import * as hydration from "@/hooks/useHydrated"
import { jsonResponse, navigation, renderWithProviders, router } from "../../testUtils"

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

  it("reads the current user only after hydration, as the server-rendered page did not know it", async () => {
    const fetch = mockBackend(USER)
    vi.spyOn(hydration, "useHydrated").mockReturnValue(false)
    renderWithProviders(<UsersView />)

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument()
    expect(screen.queryByText("No access")).not.toBeInTheDocument()
  })

  it("does not query the users for a non-superuser", async () => {
    const fetch = mockBackend(USER)
    renderWithProviders(<UsersView />)

    expect(await screen.findByText("No access")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument()
    const paths = fetch.mock.calls.map((call) => new URL((call[0] as Request).url).pathname)
    expect(paths).not.toContain("/api/v1/users/")
  })

  it("creates a user from the dialog", async () => {
    let body: unknown
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input as Request
      const path = new URL(request.url).pathname
      if (request.method === "POST" && path === "/api/v1/users/") {
        body = await request.json()
        return jsonResponse({ ...USER, id: "n" }, 201)
      }
      return path === "/api/v1/users/me" ? jsonResponse(ADMIN) : jsonResponse({ data: [ADMIN], count: 1 })
    })
    renderWithProviders(<UsersView />)

    await userEvent.click(await screen.findByRole("button", { name: "Add user" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox", { name: /email/i }), "new@example.com")
    await userEvent.type(within(dialog).getByLabelText(/^password/i), "secret123")
    await userEvent.type(within(dialog).getByLabelText(/^confirm password/i), "secret123")
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }))

    expect(await screen.findByText("User created")).toBeInTheDocument()
    expect(body).toEqual({
      email: "new@example.com",
      full_name: null,
      password: "secret123",
      is_superuser: false,
      is_active: true,
    })
  })

  it("closes the dialog on cancel", async () => {
    mockBackend(ADMIN)
    renderWithProviders(<UsersView />)

    await userEvent.click(await screen.findByRole("button", { name: "Add user" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("goes back to the last page that has rows", async () => {
    navigation.pathname = "/admin"
    navigation.searchParams = new URLSearchParams("page=4")
    mockBackend(ADMIN)
    renderWithProviders(<UsersView />)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin", { scroll: false }))
  })

  it("shows the loading, empty and error states", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      new URL((input as Request).url).pathname === "/api/v1/users/me"
        ? jsonResponse(ADMIN)
        : jsonResponse({ data: [], count: 0 }),
    )
    const { container } = renderWithProviders(<UsersView />)
    expect(container.querySelector(".skeleton")).toBeInTheDocument()
    expect(await screen.findByText("No users found")).toBeInTheDocument()
  })

  it("shows the error of a failed load", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      new URL((input as Request).url).pathname === "/api/v1/users/me"
        ? jsonResponse(ADMIN)
        : jsonResponse({ detail: "Database is down" }, 503),
    )
    renderWithProviders(<UsersView />)
    expect(
      await screen.findByText(
        "The server failed to handle the request. Please try again later.",
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
  })

  it("dims the previous page while the next one loads", async () => {
    navigation.searchParams = new URLSearchParams("page=1")
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL((input as Request).url)
      if (url.pathname === "/api/v1/users/me") {
        return jsonResponse(ADMIN)
      }
      return url.searchParams.get("skip") === "0"
        ? jsonResponse({ data: [ADMIN, USER], count: 30 })
        : new Promise<Response>(() => undefined)
    })
    const { rerender } = renderWithProviders(<UsersView />)
    await screen.findByText("user@example.com")

    navigation.searchParams = new URLSearchParams("page=2")
    rerender(<UsersView />)

    await waitFor(() => expect(screen.getByRole("grid", { name: "Users" })).toHaveClass("opacity-50"))
  })
})
