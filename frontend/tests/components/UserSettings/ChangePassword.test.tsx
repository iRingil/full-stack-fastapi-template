import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ChangePassword } from "@/components/UserSettings/ChangePassword"
import { jsonResponse, mockApi, renderWithProviders } from "../../testUtils"

/** Fills and submits the password form. */
async function change(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/^current password/i), "oldpass123")
  await userEvent.type(screen.getByLabelText(/^new password/i), "newpass123")
  await userEvent.type(screen.getByLabelText(/^confirm password/i), "newpass123")
  await userEvent.click(screen.getByRole("button", { name: "Change password" }))
}

describe("ChangePassword", () => {
  it("changes the password and clears the form", async () => {
    let body: unknown
    mockApi({
      "PATCH /api/v1/users/me/password": async (request) => {
        body = await request.json()
        return jsonResponse({ message: "ok" })
      },
    })
    renderWithProviders(<ChangePassword />)

    await change()

    expect(await screen.findByText("Password changed")).toBeInTheDocument()
    expect(body).toEqual({ current_password: "oldpass123", new_password: "newpass123" })
    await waitFor(() => expect(screen.getByLabelText(/^current password/i)).toHaveValue(""))
  })

  it("shows a wrong current password next to the form", async () => {
    mockApi({ "PATCH /api/v1/users/me/password": () => jsonResponse({ detail: "Incorrect password" }, 400) })
    renderWithProviders(<ChangePassword />)

    await change()

    expect(await screen.findByText("Incorrect password")).toBeInTheDocument()
  })
})
