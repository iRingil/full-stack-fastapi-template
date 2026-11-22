import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ItemPublic } from "@/client/types.gen"
import { ItemsView } from "@/components/Items/ItemsView"
import { jsonResponse, navigation, REGULAR_USER, renderWithProviders, router, SUPERUSER } from "../../testUtils"

const ITEM: ItemPublic = {
  id: "i1",
  owner_id: "u1",
  owner_email: "owner@example.com",
  title: "First",
  description: null,
}

/**
 * Mocks the backend: the items list plus whatever `handle` answers for other requests.
 * @param items - The list to return.
 * @param count - The total count.
 * @param handle - Answers for the other requests.
 * @param user - The current user.
 * @returns The fetch spy.
 */
function mockBackend(
  items: ItemPublic[],
  count: number,
  handle?: (request: Request) => Response,
  user: object = REGULAR_USER,
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request
    const { pathname } = new URL(request.url)
    if (request.method === "GET" && pathname === "/api/v1/items/") {
      return jsonResponse({ data: items, count })
    }
    if (request.method === "GET" && pathname === "/api/v1/users/me") {
      return jsonResponse(user)
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
    const urls: URL[] = fetch.mock.calls.map(([input]) => new URL((input as Request).url))
    const url = urls.find((candidate) => candidate.pathname === "/api/v1/items/")
    expect(url?.searchParams.get("skip")).toBe("10")
    expect(url?.searchParams.get("limit")).toBe("10")
    // The full title is in the tooltip of the (truncated) cell; a user sees only own items, without the owner
    expect(screen.getByText("First")).toHaveAttribute("title", "First")
    expect(screen.queryByRole("columnheader", { name: "Owner" })).not.toBeInTheDocument()
  })

  it("shows a superuser whose each item is", async () => {
    mockBackend([{ ...ITEM, description: "About it" }], 1, undefined, SUPERUSER)
    renderWithProviders(<ItemsView />)

    expect(await screen.findByRole("columnheader", { name: "Owner" })).toBeInTheDocument()
    expect(screen.getByText("owner@example.com")).toBeInTheDocument()
    expect(screen.getByText("About it")).toHaveAttribute("title", "About it")
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
    // Typing can start at once, and the close button has a name in the language of the page
    await waitFor(() => expect(within(dialog).getByRole("textbox", { name: /title/i })).toHaveFocus())
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument()
    await userEvent.type(within(dialog).getByRole("textbox", { name: /title/i }), "New")
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]?.method).toBe("POST")
    expect(await created[0]?.json()).toEqual({ title: "New", description: null })
    expect(await screen.findByText("Item created")).toBeInTheDocument()
    // The list is fetched again after the change
    const listCalls = (): number =>
      fetch.mock.calls.filter(([input]) => new URL((input as Request).url).pathname === "/api/v1/items/").length
    await waitFor(() => expect(listCalls()).toBeGreaterThanOrEqual(2))
  })

  it("shows the error of a failed load", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "Database is down" }, 503))
    renderWithProviders(<ItemsView />)
    expect(
      await screen.findByText(
        "The server failed to handle the request. Please try again later.",
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
  })

  it("dims the rows of the previous page while the next one loads", async () => {
    navigation.searchParams = new URLSearchParams("page=1")
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const skip = new URL((input as Request).url).searchParams.get("skip")
      return skip === "0" ? jsonResponse({ data: [ITEM], count: 20 }) : new Promise<Response>(() => undefined)
    })
    const { rerender } = renderWithProviders(<ItemsView />)
    await screen.findByText("First")

    navigation.searchParams = new URLSearchParams("page=2")
    rerender(<ItemsView />)

    await waitFor(() => expect(screen.getByRole("grid", { name: "Items" })).toHaveClass("opacity-50"))
  })

  it("closes the add dialog on cancel", async () => {
    mockBackend([], 0)
    renderWithProviders(<ItemsView />)

    await userEvent.click(await screen.findByRole("button", { name: "Add item" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })
})
