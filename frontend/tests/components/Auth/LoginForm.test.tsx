import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { LoginForm } from "@/components/Auth/LoginForm"
import { jsonResponse, navigation, renderWithProviders, router } from "../../testUtils"

/**
 * Fills and submits the login form.
 * @param email - The email to type.
 * @param password - The password to type.
 */
async function submit(email: string, password: string): Promise<void> {
  if (email) {
    await userEvent.type(screen.getByRole("textbox", { name: /email/i }), email)
  }
  if (password) {
    await userEvent.type(screen.getByLabelText(/^password/i), password)
  }
  await userEvent.click(screen.getByRole("button", { name: "Log in" }))
}

describe("LoginForm", () => {
  it("validates the fields before sending anything", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
    renderWithProviders(<LoginForm />)

    await submit("", "")

    expect(await screen.findAllByText("This field is required")).toHaveLength(2)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("logs in and returns to the page the user came from", async () => {
    navigation.searchParams = new URLSearchParams("from=/items?page=2")
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }))
    renderWithProviders(<LoginForm />)

    await submit("ada@example.com", "secret12")

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/items?page=2"))
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/auth/login")
  })

  it("does not follow a redirect to another site", async () => {
    navigation.searchParams = new URLSearchParams("from=//evil.example")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }))
    renderWithProviders(<LoginForm />)

    await submit("ada@example.com", "secret12")

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"))
  })

  it("shows the backend's error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "Incorrect email or password" }, 400))
    renderWithProviders(<LoginForm />)

    await submit("ada@example.com", "wrong-pass")

    expect(await screen.findByText("Incorrect email or password")).toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })
})
