/**
 * @file Global test setup: jest-dom matchers, mocked navigation, an absolute API base URL and cleanup.
 */

import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { afterEach, vi } from "vitest"
import { client } from "@/client/client.gen"
import { installApiErrors } from "@/lib/api-error"
import { navigation, router } from "./testUtils"

// jsdom lacks ResizeObserver, which HeroUI's toasts measure themselves with
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// The browser resolves "/api/v1/..." against the page; jsdom's Request needs an absolute URL
client.setConfig({ baseUrl: "http://localhost" })
// As in the app (components/Providers.tsx): failed requests throw ApiError
installApiErrors()

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }): ReactNode => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => navigation.pathname,
  getPathname: ({ href }: { href: string }) => href,
  redirect: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.searchParams,
  usePathname: () => navigation.pathname,
  useRouter: () => router,
  notFound: vi.fn(),
}))

afterEach((): void => {
  cleanup()
  vi.restoreAllMocks()
  router.push.mockReset()
  router.replace.mockReset()
  router.refresh.mockReset()
  navigation.pathname = "/"
  navigation.searchParams = new URLSearchParams()
})
