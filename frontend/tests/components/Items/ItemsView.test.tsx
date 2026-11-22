import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ItemPublic } from "@/client/types.gen"
import { ItemsView } from "@/components/Items/ItemsView"
import { jsonResponse, navigation, renderWithProviders, router } from "../../testUtils"

const ITEM: ItemPublic = { id: "i1", owner_id: "u1", title: "First", description: null }

/**
 * Mocks the backend: the items list plus whatever `handle` answers for other requests.
 * @param items - The list to return.
 * @param count - The total count.
 * @param handle - Answers for non-list requests.
 * @returns The fetch spy.
 */
function mockBackend(items: ItemPublic[], count: number, handle?: (request: Request) => Response) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request
    if (request.method === "GET" && new URL(request.url).pathname === "/api/v1/items/") {
      return jsonResponse({ data: items, count })
    }
    return handle?.(request) ?? jsonResponse({ detail: "unexpected" }, 500)
  })
}

describe("ItemsView", () => {
  it("lists the items of the current page", async () => {
    navigation.searchParams = new URLSearchParams("page=2")
    const fetch = mockBackend([ITEM], 11)
    renderWithProviders(<ItemsView />)

    expect(await screen.findByText("First")).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.getByText("11–11 of 11")).toBeInTheDocument()
    const url = new URL((fetch.mock.calls[0]?.[0] as Request | undefined)?.url ?? "")
    expect(url.searchParams.get("skip")).toBe("10")
    expect(url.searchParams.get("limit")).toBe("10")
  })

  it("shows the empty state", async () => {
    mockBackend([], 0)
    renderWithProviders(<ItemsView />)
    expect(await screen.findByText("You don't have any items yet")).toBeInTheDocument()
  })

  it("goes back to the last page that has rows", async () => {
    navigation.pathname = "/items"
    navigation.searchParams = new URLSearchParams("page=3")
    mockBackend([], 10)
    renderWithProviders(<ItemsView />)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/items", { scroll: false }))
  })

  it("creates an item and refreshes the list", async () => {
    const created: Request[] = []
    const fetch = mockBackend([], 0, (request) => {
      created.push(request)
      return jsonResponse({ ...ITEM, title: "New" }, 201)
    })
    renderWithProviders(<ItemsView />)
    await screen.findByText("You don't have any items yet")

    await userEvent.click(screen.getByRole("button", { name: "Add item" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox", { name: /title/i }), "New")
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]?.method).toBe("POST")
    expect(await created[0]?.json()).toEqual({ title: "New", description: null })
    expect(await screen.findByText("Item created")).toBeInTheDocument()
    // The list is fetched again after the change
    await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(3))
  })

  it("shows the error of a failed load", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "Database is down" }, 503))
    renderWithProviders(<ItemsView />)
    expect(await screen.findByText("Database is down", {}, { timeout: 5000 })).toBeInTheDocument()
  })
})
