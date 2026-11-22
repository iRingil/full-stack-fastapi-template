import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { DashboardView } from "@/components/Dashboard/DashboardView"
import { jsonResponse, mockApi, REGULAR_USER, renderWithProviders, SUPERUSER } from "../../testUtils"

describe("DashboardView", () => {
  it("shows a placeholder while the user loads", () => {
    mockApi({ "GET /api/v1/users/me": () => new Promise<Response>(() => undefined) })
    const { container } = renderWithProviders(<DashboardView />)
    expect(container.querySelector(".skeleton")).toBeInTheDocument()
  })

  it("greets a confirmed user by name, without the notice", async () => {
    mockApi({ "GET /api/v1/users/me": SUPERUSER })
    renderWithProviders(<DashboardView />)

    expect(await screen.findByRole("heading", { name: /Hi, Ada Admin/ })).toBeInTheDocument()
    expect(screen.queryByText("Confirm your email")).not.toBeInTheDocument()
  })

  it("asks an unconfirmed user to confirm the email and sends the link again", async () => {
    mockApi({
      "GET /api/v1/users/me": REGULAR_USER,
      "POST /api/v1/resend-verification/": { message: "sent" },
    })
    renderWithProviders(<DashboardView />)

    expect(await screen.findByRole("heading", { name: /Hi, user@example.com/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Send again" }))
    expect(await screen.findByText("A new confirmation link is on its way")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send again" })).toBeDisabled()
  })

  it("reports a failed resend", async () => {
    mockApi({
      "GET /api/v1/users/me": REGULAR_USER,
      "POST /api/v1/resend-verification/": () => jsonResponse({ detail: "Too many requests" }, 429),
    })
    renderWithProviders(<DashboardView />)

    await userEvent.click(await screen.findByRole("button", { name: "Send again" }))
    expect(await screen.findByText("Too many requests")).toBeInTheDocument()
  })
})
