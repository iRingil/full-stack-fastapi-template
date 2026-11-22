import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { VerifyEmail } from "@/components/Auth/VerifyEmail"
import { calls, jsonResponse, mockApi, navigation, renderWithProviders } from "../../testUtils"

/** Asks for a new link for user@example.com. */
async function resend(): Promise<void> {
  await userEvent.type(screen.getByRole("textbox", { name: /email/i }), "user@example.com")
  await userEvent.click(screen.getByRole("button", { name: "Send a new link" }))
}

describe("VerifyEmail", () => {
  it("confirms the email once and refreshes the cached profile", async () => {
    navigation.searchParams = new URLSearchParams("token=abc")
    const fetch = mockApi({ "POST /api/v1/verify-email/": { message: "ok" } })
    const { queryClient } = renderWithProviders(<VerifyEmail />)
    queryClient.setQueryData([{ _id: "readUserMe", baseUrl: "http://localhost" }], { is_email_verified: false })

    expect(screen.getByRole("heading", { name: "Confirming your email…" })).toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: "Email confirmed" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/dashboard")
    expect(calls(fetch)).toEqual(["POST /api/v1/verify-email/"])
    expect(queryClient.getQueryState([{ _id: "readUserMe", baseUrl: "http://localhost" }])?.isInvalidated).toBe(true)
  })

  it("explains a missing token and sends a new link", async () => {
    mockApi({ "POST /api/v1/resend-verification/": { message: "sent" } })
    renderWithProviders(<VerifyEmail />)

    expect(screen.getByText(/The link is incomplete/)).toBeInTheDocument()
    await resend()
    expect(await screen.findByText(/a new link is on its way/)).toBeInTheDocument()
  })

  it("shows why the token failed and the error of the resend", async () => {
    navigation.searchParams = new URLSearchParams("token=old")
    mockApi({
      "POST /api/v1/verify-email/": () => jsonResponse({ detail: "Invalid or expired verification token" }, 400),
      "POST /api/v1/resend-verification/": () => jsonResponse({ detail: "Too many requests" }, 429),
    })
    renderWithProviders(<VerifyEmail />)

    expect(await screen.findByText("The link is invalid or expired. Request a new one.")).toBeInTheDocument()
    await resend()
    await waitFor(() => expect(screen.getByText("Too many requests. Wait a minute and try again.")).toBeInTheDocument())
  })
})
