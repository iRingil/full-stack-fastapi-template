import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { useErrorMessage } from "@/hooks/useErrorMessage"
import { ApiError } from "@/lib/api-error"
import { renderWithProviders } from "../testUtils"

let errorMessage: ReturnType<typeof useErrorMessage>

/** Exposes the hook to the test. */
function Probe(): ReactNode {
  errorMessage = useErrorMessage()
  return null
}

describe("useErrorMessage", () => {
  it("translates the backend's English message into the language of the page", () => {
    renderWithProviders(<Probe />)
    expect(errorMessage(new ApiError(400, { detail: "Incorrect password" }))).toBe("The current password is incorrect")
    expect(errorMessage(new ApiError(0, new TypeError("fetch failed")))).toBe(
      "No connection to the server. Check your internet connection and try again.",
    )
    expect(errorMessage(new Error("boom"))).toBe("The request failed. Please try again.")
  })
})
