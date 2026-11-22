import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { UserInformation } from "@/components/UserSettings/UserInformation"
import { jsonResponse, mockApi, REGULAR_USER, renderWithProviders } from "../../testUtils"

describe("UserInformation", () => {
  it("saves the edited profile and updates the cached user", async () => {
    let body: unknown
    mockApi({
      "GET /api/v1/users/me": REGULAR_USER,
      "PATCH /api/v1/users/me": async (request) => {
        body = await request.json()
        return jsonResponse({ ...REGULAR_USER, full_name: "Bob" })
      },
    })
    renderWithProviders(<UserInformation />)

    const name = screen.getByRole("textbox", { name: /full name/i })
    expect(await screen.findByDisplayValue("user@example.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    await userEvent.type(name, "Bob")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Profile saved")).toBeInTheDocument()
    // The email is unchanged, so no password is asked for or sent
    expect(body).toEqual({ full_name: "Bob", email: "user@example.com" })
    expect(screen.queryByLabelText(/^current password/i)).not.toBeInTheDocument()
  })

  it("asks for the current password to change the email", async () => {
    let body: unknown
    mockApi({
      "GET /api/v1/users/me": REGULAR_USER,
      "PATCH /api/v1/users/me": async (request) => {
        body = await request.json()
        return jsonResponse({ ...REGULAR_USER, email: "new@example.com" })
      },
    })
    renderWithProviders(<UserInformation />)

    const email = await screen.findByDisplayValue("user@example.com")
    await userEvent.clear(email)
    await userEvent.type(email, "new@example.com")
    const password = screen.getByLabelText(/^current password/i)
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("This field is required")).toBeInTheDocument()
    expect(body).toBeUndefined()

    await userEvent.type(password, "secret123")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Profile saved")).toBeInTheDocument()
    expect(body).toEqual({ full_name: null, email: "new@example.com", current_password: "secret123" })
    // The saved address is the current one now: the password field is gone
    await waitFor(() => expect(screen.queryByLabelText(/^current password/i)).not.toBeInTheDocument())
  })

  it("keeps the entered values when saving fails", async () => {
    mockApi({
      "GET /api/v1/users/me": REGULAR_USER,
      "PATCH /api/v1/users/me": () => jsonResponse({ detail: "User with this email already exists" }, 409),
    })
    renderWithProviders(<UserInformation />)

    const email = await screen.findByDisplayValue("user@example.com")
    await userEvent.clear(email)
    await userEvent.type(email, "taken@example.com")
    await userEvent.type(screen.getByLabelText(/^current password/i), "secret123")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("This email is already used by another account")).toBeInTheDocument()
    expect(email).toHaveValue("taken@example.com")
  })
})
