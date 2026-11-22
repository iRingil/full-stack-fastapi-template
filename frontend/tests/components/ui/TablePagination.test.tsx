import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TablePagination, visiblePages } from "@/components/ui/TablePagination"
import { renderWithProviders } from "../../testUtils"

describe("visiblePages", () => {
  it("lists all pages when there are few", () => {
    expect(visiblePages(1, 3)).toEqual([1, 2, 3])
  })

  it("collapses the gaps into ellipses", () => {
    expect(visiblePages(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10])
    expect(visiblePages(1, 10)).toEqual([1, 2, "ellipsis", 10])
    expect(visiblePages(10, 10)).toEqual([1, "ellipsis", 9, 10])
  })
})

describe("TablePagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = renderWithProviders(
      <TablePagination page={1} pageSize={10} total={10} onPageChange={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the range and changes the page", async () => {
    const onPageChange = vi.fn()
    renderWithProviders(<TablePagination page={2} pageSize={10} total={25} onPageChange={onPageChange} />)

    expect(screen.getByText("11–20 of 25")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /next/i }))
    await userEvent.click(screen.getByRole("button", { name: /previous/i }))
    await userEvent.click(screen.getByRole("button", { name: "3" }))
    expect(onPageChange.mock.calls).toEqual([[3], [1], [3]])
  })

  it("disables previous on the first page and next on the last", () => {
    const { rerender } = renderWithProviders(
      <TablePagination page={1} pageSize={10} total={25} onPageChange={vi.fn()} />,
    )
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled()
    rerender(<TablePagination page={3} pageSize={10} total={25} onPageChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled()
  })
})
