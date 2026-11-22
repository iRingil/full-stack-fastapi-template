import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { UserPublic } from "@/client/types.gen"
import { UserActionsMenu } from "@/components/Admin/UserActionsMenu"
import { calls, jsonResponse, mockApi, renderWithProviders } from "../../testUtils"

const USER: UserPublic = {
  id: "u1",
  email: "user@example.com",
  full_name: "Bob",
  is_superuser: false,
  is_active: true,
}

/**
 * Opens the row menu and picks an action.
 * @param action - The menu item's name.
 */
async function choose(action: "Edit" | "Delete"): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "Actions for user@example.com" }))
  await userEvent.click(await screen.findByRole("menuitem", { name: action }))
}

describe("UserActionsMenu", () => {
  it("is disabled for the admin themself", () => {
    renderWithProviders(<UserActionsMenu user={USER} isCurrentUser />)
    expect(screen.getByRole("button", { name: "Actions for user@example.com" })).toBeDisabled()
  })

  it("edits the user and keeps the password when the field is empty", async () => {
    const bodies: unknown[] = []
    mockApi({
      "PATCH /api/v1/users/u1": async (request) => {
        bodies.push(await request.json())
        return jsonResponse(USER)
      },
      "GET /api/v1/users/": { data: [], count: 0 },
      "GET /api/v1/users/me": USER,
    })
    renderWithProviders(<UserActionsMenu user={USER} isCurrentUser={false} />)

    await choose("Edit")
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("textbox", { name: /email/i })).toHaveValue("user@example.com")
    await userEvent.click(within(dialog).getByRole("switch", { name: /superuser/i }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))

    expect(await screen.findByText("User saved")).toBeInTheDocument()
    expect(bodies[0]).toEqual({
      email: "user@example.com",
      full_name: "Bob",
      is_superuser: true,
      is_active: true,
    })
  })

  it("sends a new password when one is entered", async () => {
    const bodies: unknown[] = []
    mockApi({
      "PATCH /api/v1/users/u1": async (request) => {
        bodies.push(await request.json())
        return jsonResponse(USER)
      },
      "GET /api/v1/users/": { data: [], count: 0 },
      "GET /api/v1/users/me": USER,
    })
    renderWithProviders(<UserActionsMenu user={USER} isCurrentUser={false} />)

    await choose("Edit")
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText(/^new password/i), "newpass123")
    await userEvent.type(within(dialog).getByLabelText(/^confirm password/i), "newpass123")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))

    await screen.findByText("User saved")
    expect(bodies[0]).toMatchObject({ password: "newpass123" })
  })

  it("deletes the user after confirmation", async () => {
    const fetch = mockApi({
      "DELETE /api/v1/users/u1": { message: "deleted" },
      "GET /api/v1/users/": { data: [], count: 0 },
      "GET /api/v1/users/me": USER,
    })
    renderWithProviders(<UserActionsMenu user={USER} isCurrentUser={false} />)

    await choose("Delete")
    const dialog = await screen.findByRole("alertdialog", { name: "Delete the user?" })
    expect(dialog).toHaveTextContent("user@example.com and all their items will be deleted permanently.")
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("User deleted")).toBeInTheDocument()
    expect(calls(fetch)).toContain("DELETE /api/v1/users/u1")
  })

  it("keeps the confirmation open when deleting fails", async () => {
    mockApi({ "DELETE /api/v1/users/u1": () => jsonResponse({ detail: "User not found" }, 404) })
    renderWithProviders(<UserActionsMenu user={USER} isCurrentUser={false} />)

    await choose("Delete")
    await userEvent.click(
      within(await screen.findByRole("alertdialog", { name: "Delete the user?" })).getByRole("button", {
        name: "Delete",
      }),
    )

    expect(await screen.findByText("Not found. It may have been deleted already.")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("alertdialog", { name: "Delete the user?" })).toBeInTheDocument())
  })
})
