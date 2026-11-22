/**
 * @file Rendering helpers: components get the English messages and a fresh query client.
 * @description `@/i18n/navigation` and `next/navigation` are mocked for all tests (`setupTests.tsx`): the router
 * records calls in {@link router}, the path and query come from {@link navigation}.
 */

import { Toast } from "@heroui/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactElement, ReactNode } from "react"
import { vi } from "vitest"
import messages from "../messages/en.json"

/**
 * Renders a component inside the app's i18n and query providers, with the toast region.
 * @param ui - The component.
 * @param queryClient - The query client; a new one without retries by default.
 * @returns Testing Library's result plus the query client.
 */
export function renderWithProviders(
  ui: ReactElement,
  queryClient: QueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
): ReturnType<typeof render> & { queryClient: QueryClient } {
  const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <QueryClientProvider client={queryClient}>
        {children}
        <Toast.Provider />
      </QueryClientProvider>
    </NextIntlClientProvider>
  )
  return Object.assign(render(ui, { wrapper }), { queryClient })
}

/** Spies of the mocked locale-aware router (`@/i18n/navigation`, mocked in `setupTests.tsx`); reset after each test. */
export const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }

/** State of the mocked navigation: set the path and the query string a test needs. */
export const navigation = { pathname: "/", searchParams: new URLSearchParams() }

/**
 * Builds a JSON response like the backend's.
 * @param body - The body.
 * @param status - The HTTP status.
 * @returns The response.
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

/**
 * Builds a JWT-shaped token with the given payload (the signature is irrelevant here).
 * @param payload - The claims.
 * @returns The token.
 */
export function fakeJwt(payload: object): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`
}
