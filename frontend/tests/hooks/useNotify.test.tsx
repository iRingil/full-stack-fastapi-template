import { act, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { useNotify } from "@/hooks/useNotify"
import { ApiError } from "@/lib/api-error"
import { renderWithProviders } from "../testUtils"

let notify: ReturnType<typeof useNotify>

/** Exposes the hook to the test. */
function Probe(): ReactNode {
  notify = useNotify()
  return null
}

describe("useNotify", () => {
  it("shows successes and errors, with the backend's message or a generic one", async () => {
    renderWithProviders(<Probe />)

    act(() => notify.success("Saved"))
    act(() => notify.error(new ApiError(409, { detail: "Already exists" })))
    act(() => notify.error(new Error("boom")))

    expect(await screen.findByText("Saved")).toBeInTheDocument()
    expect(screen.getByText("Already exists")).toBeInTheDocument()
    expect(screen.getByText("The request failed. Please try again.")).toBeInTheDocument()
  })

  it("stays silent on a 401, which logs the user out anyway", () => {
    renderWithProviders(<Probe />)
    act(() => notify.error(new ApiError(401, { detail: "Could not validate credentials" })))
    expect(screen.queryByText("Could not validate credentials")).not.toBeInTheDocument()
  })
})
