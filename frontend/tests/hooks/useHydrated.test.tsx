import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { useHydrated } from "@/hooks/useHydrated"

/**
 * Prints the flag.
 * @returns "true" or "false".
 */
function Probe(): ReactNode {
  return String(useHydrated())
}

describe("useHydrated", () => {
  it("is false in the server render", () => {
    expect(renderToString(<Probe />)).toBe("false")
  })

  it("is true in a client render", () => {
    expect(renderHook(() => useHydrated()).result.current).toBe(true)
  })
})
