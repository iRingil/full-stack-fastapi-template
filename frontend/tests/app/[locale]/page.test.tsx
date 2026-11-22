import { screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import HomePage, { generateMetadata } from "@/app/[locale]/page"
import { renderWithProviders } from "../../testUtils"

const params = { params: Promise.resolve({ locale: "en" }) }

describe("HomePage", () => {
  it("has its own title and language links", async () => {
    const metadata = await generateMetadata(params)
    expect(metadata.title).toEqual({ absolute: "Full Stack FastAPI — a web app template" })
    expect(metadata.alternates?.canonical).toBe("/")
  })

  it("shows the pitch, the quick start and the features", async () => {
    renderWithProviders((await HomePage(params)) as ReactElement)

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("FastAPI and Next.js, ready to build on")
    expect(screen.getByRole("link", { name: "Open the dashboard" })).toHaveAttribute("href", "/dashboard")
    expect(screen.getByText("cd frontend && npm run dev")).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3)
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login")
  })
})
