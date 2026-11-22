import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ResetPasswordForm } from "@/components/Auth/ResetPasswordForm"
import { jsonResponse, mockApi, navigation, renderWithProviders } from "../../testUtils"

/** Types matching passwords and submits. */
async function submit(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/^new password/i), "newpass123")
  await userEvent.type(screen.getByLabelText(/^confirm password/i), "newpass123")
  await userEvent.click(screen.getByRole("button", { name: "Set password" }))
}

describe("ResetPasswordForm", () => {
  it("points to a new link when the token is missing", () => {
    renderWithProviders(<ResetPasswordForm />)
    expect(screen.getByRole("heading", { name: "The link is incomplete" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/recover-password")
  })

  it("sets the new password with the token from the link", async () => {
    navigation.searchParams = new URLSearchParams("token=abc")
    let body: unknown
    mockApi({
      "POST /api/v1/reset-password/": async (request) => {
        body = await request.json()
        return jsonResponse({ message: "ok" })
      },
    })
    renderWithProviders(<ResetPasswordForm />)

    await submit()

    expect(await screen.findByRole("heading", { name: "Password changed" })).toBeInTheDocument()
    expect(body).toEqual({ token: "abc", new_password: "newpass123" })
  })

  it("shows the backend's error", async () => {
    navigation.searchParams = new URLSearchParams("token=old")
    mockApi({ "POST /api/v1/reset-password/": () => jsonResponse({ detail: "Invalid token" }, 400) })
    renderWithProviders(<ResetPasswordForm />)

    await submit()

    expect(
      await screen.findByText("The link is invalid, expired or already used. Request a new one."),
    ).toBeInTheDocument()
  })
})
