import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FormAlert } from "@/components/ui/FormAlert"
import { renderWithProviders } from "../../testUtils"

describe("FormAlert", () => {
  it("renders nothing without content", () => {
    const { container } = renderWithProviders(<FormAlert />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders a title alone", () => {
    renderWithProviders(<FormAlert status="success" title="Saved" />)
    expect(screen.getByText("Saved")).toBeInTheDocument()
  })

  it("renders a title with a description", () => {
    renderWithProviders(<FormAlert title="No access">Ask an admin</FormAlert>)
    expect(screen.getByText("No access")).toBeInTheDocument()
    expect(screen.getByText("Ask an admin")).toBeInTheDocument()
  })
})
