import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { ItemPublic } from "@/client/types.gen"
import { ItemActionsMenu } from "@/components/Items/ItemActionsMenu"
import { jsonResponse, mockApi, renderWithProviders } from "../../testUtils"

const ITEM: ItemPublic = {
  id: "i1",
  owner_id: "u1",
  owner_email: "user@example.com",
  title: "First",
  description: "About it",
}

/**
 * Opens the row menu and picks an action.
 * @param action - The menu item's name.
 */
async function choose(action: "Edit" | "Delete"): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "Actions for First" }))
  await userEvent.click(await screen.findByRole("menuitem", { name: action }))
}

describe("ItemActionsMenu", () => {
  it("edits the item in a dialog filled with its values", async () => {
    let body: unknown
    mockApi({
      "PUT /api/v1/items/i1": async (request) => {
        body = await request.json()
        return jsonResponse({ ...ITEM, title: "Renamed" })
      },
      "GET /api/v1/items/": { data: [], count: 0 },
    })
    renderWithProviders(<ItemActionsMenu item={ITEM} />)

    await choose("Edit")
    const dialog = await screen.findByRole("dialog")
    const title = within(dialog).getByRole("textbox", { name: /title/i })
    expect(title).toHaveValue("First")
    expect(within(dialog).getByRole("textbox", { name: /description/i })).toHaveValue("About it")
    await userEvent.clear(title)
    await userEvent.type(title, "Renamed")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Item saved")).toBeInTheDocument()
    expect(body).toEqual({ title: "Renamed", description: "About it" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("keeps the dialog open when saving fails", async () => {
    mockApi({ "PUT /api/v1/items/i1": () => jsonResponse({ detail: "Item not found" }, 404) })
    renderWithProviders(<ItemActionsMenu item={ITEM} />)

    await choose("Edit")
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Not found. It may have been deleted already.")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("deletes the item after confirmation", async () => {
    mockApi({ "DELETE /api/v1/items/i1": { message: "deleted" }, "GET /api/v1/items/": { data: [], count: 0 } })
    renderWithProviders(<ItemActionsMenu item={ITEM} />)

    await choose("Delete")
    const dialog = await screen.findByRole("alertdialog", { name: "Delete the item?" })
    expect(dialog).toHaveTextContent("“First” will be deleted permanently.")
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("Item deleted")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Delete the item?" })).not.toBeInTheDocument())
  })

  it("keeps the confirmation open when deleting fails, and cancels", async () => {
    mockApi({ "DELETE /api/v1/items/i1": () => jsonResponse({ detail: "Not enough permissions" }, 403) })
    renderWithProviders(<ItemActionsMenu item={ITEM} />)

    await choose("Delete")
    const dialog = await screen.findByRole("alertdialog", { name: "Delete the item?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))
    expect(await screen.findByText("You do not have permission to do this.")).toBeInTheDocument()

    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Delete the item?" })).getByRole("button", { name: "Cancel" }),
    )
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Delete the item?" })).not.toBeInTheDocument())
  })
})
