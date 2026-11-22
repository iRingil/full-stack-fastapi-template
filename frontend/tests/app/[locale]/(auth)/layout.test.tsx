import { screen } from "@testing-library/react"
import { setRequestLocale } from "next-intl/server"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import AuthLayout from "@/app/[locale]/(auth)/layout"
import { renderWithProviders } from "../../../testUtils"

describe("AuthLayout", () => {
  it("centers the page under a header without the login links", async () => {
    const element = await AuthLayout({ children: <p>form</p>, params: Promise.resolve({ locale: "ru" }) })
    renderWithProviders(element as ReactElement)

    expect(setRequestLocale).toHaveBeenCalledWith("ru")
    expect(screen.getByRole("main")).toHaveTextContent("form")
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument()
  })
})
