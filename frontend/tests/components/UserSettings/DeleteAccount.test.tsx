import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { DeleteAccount } from "@/components/UserSettings/DeleteAccount"
import { calls, jsonResponse, mockApi, renderWithProviders, router } from "../../testUtils"

/** Opens the confirmation and confirms. */
async function confirmDeletion(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "Delete account" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Delete your account?" })
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete account" }))
}

describe("DeleteAccount", () => {
  it("deletes the account and logs out", async () => {
    const fetch = mockApi({
      "DELETE /api/v1/users/me": { message: "deleted" },
      "POST /api/auth/logout": () => new Response(null, { status: 204 }),
    })
    renderWithProviders(<DeleteAccount />)

    await confirmDeletion()

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"))
    expect(calls(fetch)).toEqual(["DELETE /api/v1/users/me", "POST /api/auth/logout"])
    expect(await screen.findByText("Your account has been deleted")).toBeInTheDocument()
  })

  it("reports a refusal and keeps the user logged in", async () => {
    mockApi({
      "DELETE /api/v1/users/me": () =>
        jsonResponse({ detail: "Super users are not allowed to delete themselves" }, 403),
    })
    renderWithProviders(<DeleteAccount />)

    await confirmDeletion()

    expect(await screen.findByText("Superusers cannot delete their own account")).toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("closes the confirmation on cancel", async () => {
    renderWithProviders(<DeleteAccount />)

    await userEvent.click(screen.getByRole("button", { name: "Delete account" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Delete your account?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "Delete your account?" })).not.toBeInTheDocument(),
    )
  })
})
