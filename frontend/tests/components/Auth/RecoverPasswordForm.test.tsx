import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RecoverPasswordForm } from "@/components/Auth/RecoverPasswordForm"
import { jsonResponse, renderWithProviders } from "../../testUtils"

/** Types an email and submits the form. */
async function submit(): Promise<void> {
  await userEvent.type(screen.getByRole("textbox", { name: /email/i }), "ada@example.com")
  await userEvent.click(screen.getByRole("button", { name: "Send the link" }))
}

describe("RecoverPasswordForm", () => {
  it("asks the backend for the link", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ message: "sent" }))
    renderWithProviders(<RecoverPasswordForm />)

    await submit()

    expect(await screen.findByText("Check your email")).toBeInTheDocument()
    const request = fetch.mock.calls[0]?.[0] as Request
    expect(request.method).toBe("POST")
    expect(request.url).toBe("http://localhost/api/v1/password-recovery/ada%40example.com")
  })

  it("does not reveal that an account does not exist", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "The user does not exist" }, 404))
    renderWithProviders(<RecoverPasswordForm />)

    await submit()

    expect(await screen.findByText("Check your email")).toBeInTheDocument()
  })

  it("shows other errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "Too many requests" }, 429))
    renderWithProviders(<RecoverPasswordForm />)

    await submit()

    expect(await screen.findByText("Too many requests")).toBeInTheDocument()
  })
})
