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
    // A notice is announced politely
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
  })

  it("renders a title with a description", () => {
    renderWithProviders(<FormAlert title="No access">Ask an admin</FormAlert>)
    expect(screen.getByText("No access")).toBeInTheDocument()
    expect(screen.getByText("Ask an admin")).toBeInTheDocument()
    // An error (the default status) is announced by screen readers at once
    expect(screen.getByRole("alert")).toHaveTextContent("Ask an admin")
  })
})
