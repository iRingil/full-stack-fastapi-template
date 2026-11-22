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
    // The address travels in the body, not in the URL (URLs end up in access logs)
    const request = fetch.mock.calls[0]?.[0] as Request
    expect(request.method).toBe("POST")
    expect(request.url).toBe("http://localhost/api/v1/password-recovery/")
    expect(await request.json()).toEqual({ email: "ada@example.com" })
  })

  it("shows an error in the language of the page", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "Too many requests. Please wait a minute before trying again." }, 429),
    )
    renderWithProviders(<RecoverPasswordForm />)

    await submit()

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests. Wait a minute and try again.")
  })
})
