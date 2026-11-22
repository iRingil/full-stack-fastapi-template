import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { NotFound } from "@/components/Common/NotFound"
import { renderWithProviders } from "../../testUtils"

describe("NotFound", () => {
  it("explains the 404 and leads home", () => {
    renderWithProviders(<NotFound />)
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/")
    expect(document.title).toBe("Page not found | Full Stack FastAPI")
  })
})
