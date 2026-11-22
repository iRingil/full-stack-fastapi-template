import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { SignUpForm } from "@/components/Auth/SignUpForm"
import { jsonResponse, mockApi, REGULAR_USER, renderWithProviders } from "../../testUtils"

/**
 * Fills and submits the sign-up form.
 * @param fullName - The name to type, if any.
 */
async function signUp(fullName = ""): Promise<void> {
  if (fullName) {
    await userEvent.type(screen.getByRole("textbox", { name: /full name/i }), fullName)
  }
  await userEvent.type(screen.getByRole("textbox", { name: /email/i }), "user@example.com")
  await userEvent.type(screen.getByLabelText(/^password/i), "secret123")
  await userEvent.type(screen.getByLabelText(/^confirm password/i), "secret123")
  await userEvent.click(screen.getByRole("button", { name: "Create account" }))
}

describe("SignUpForm", () => {
  it("registers the user and asks to check the email", async () => {
    let body: unknown
    mockApi({
      "POST /api/v1/users/signup": async (request) => {
        body = await request.json()
        return jsonResponse(REGULAR_USER, 201)
      },
    })
    renderWithProviders(<SignUpForm />)

    await signUp()

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument()
    expect(screen.getByText(/We have sent a confirmation link to user@example.com/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to login" })).toHaveAttribute("href", "/login")
    expect(body).toEqual({ email: "user@example.com", password: "secret123", full_name: null })
  })

  it("sends the name when given", async () => {
    let body: unknown
    mockApi({
      "POST /api/v1/users/signup": async (request) => {
        body = await request.json()
        return jsonResponse(REGULAR_USER, 201)
      },
    })
    renderWithProviders(<SignUpForm />)

    await signUp("Ada")

    await screen.findByRole("heading", { name: "Check your email" })
    expect(body).toMatchObject({ full_name: "Ada" })
  })

  it("shows the backend's error", async () => {
    mockApi({ "POST /api/v1/users/signup": () => jsonResponse({ detail: "The user already exists" }, 400) })
    renderWithProviders(<SignUpForm />)

    await signUp()

    expect(await screen.findByText("The user already exists")).toBeInTheDocument()
  })
})
