import { screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import AuthLayout from "@/app/[locale]/(auth)/layout"
import { renderWithProviders } from "../../../testUtils"

describe("AuthLayout", () => {
  it("centers the page under a header without the login links", async () => {
    renderWithProviders(AuthLayout({ children: <p>form</p> }) as ReactElement)

    expect(screen.getByRole("main")).toHaveTextContent("form")
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument()
  })
})
