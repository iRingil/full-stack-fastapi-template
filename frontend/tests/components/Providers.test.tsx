import { Link } from "@heroui/react"
import { useQuery } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { Providers } from "@/components/Providers"
import { ApiError } from "@/lib/api-error"
import messages from "../../messages/en.json"
import { calls, mockApi, router } from "../testUtils"

/** How many times each failing query has been requested. */
const attempts: Record<string, number> = {}

/**
 * A component whose query fails with 401, like any request after the token expired.
 * @param props - The query key, so that several can fail at once.
 * @returns Nothing visible.
 */
function Unauthorized({ name }: { name: string }): ReactNode {
  useQuery({
    queryKey: [name],
    queryFn: () => {
      attempts[name] = (attempts[name] ?? 0) + 1
      return Promise.reject(new ApiError(401, {}))
    },
    retry: false,
  })
  return null
}

/**
 * A component whose query succeeds.
 * @returns "ok" once loaded.
 */
function Authorized(): ReactNode {
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => Promise.resolve("ok") })
  return data ?? null
}

/**
 * Wraps the content in the providers with the app's messages, as the root layout does.
 * @param children - The content.
 * @returns The wrapped content.
 */
const wrap = (children: ReactNode): ReactNode => (
  <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
    <Providers>{children}</Providers>
  </NextIntlClientProvider>
)

/**
 * Renders the content in the providers.
 * @param children - The content.
 * @returns Testing Library's result.
 */
const renderProviders = (children: ReactNode) => render(wrap(children))

describe("Providers", () => {
  it("logs out once when requests answer 401", async () => {
    const fetch = mockApi({ "POST /api/auth/logout": () => new Response(null, { status: 204 }) })
    renderProviders(
      <>
        <Unauthorized name="a" />
        <Unauthorized name="b" />
      </>,
    )

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"))
    // The cleared queries refetch and fail again while still mounted: no second logout
    await waitFor(() => expect(attempts.a).toBe(2))
    expect(calls(fetch)).toEqual(["POST /api/auth/logout"])
    expect(router.replace).toHaveBeenCalledTimes(1)
  })

  it("logs out again in a later session, after a request has succeeded", async () => {
    const fetch = mockApi({ "POST /api/auth/logout": () => new Response(null, { status: 204 }) })
    const { rerender } = renderProviders(<Unauthorized name="first" />)
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1))

    rerender(wrap(<Authorized />))
    await screen.findByText("ok")
    rerender(wrap(<Unauthorized name="second" />))

    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(2))
    expect(calls(fetch)).toEqual(["POST /api/auth/logout", "POST /api/auth/logout"])
  })

  it("lets HeroUI links navigate through the locale-aware router", async () => {
    renderProviders(
      <>
        <Link href="/items">Items</Link>
        <Link href="https://heroui.com">HeroUI</Link>
      </>,
    )

    // getPathname is mocked to return the path, so a local link keeps it; an external one is left alone
    expect(screen.getByRole("link", { name: "Items" })).toHaveAttribute("href", "/items")
    expect(screen.getByRole("link", { name: "HeroUI" })).toHaveAttribute("href", "https://heroui.com")
    await userEvent.click(screen.getByRole("link", { name: "Items" }))
    expect(router.push).toHaveBeenCalledWith("/items")
  })
})
