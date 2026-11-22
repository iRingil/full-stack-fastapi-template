// noinspection JSUnusedGlobalSymbols - the mocks implement what the mocked modules export
/**
 * @file Global test setup: jest-dom matchers, mocked navigation, an absolute API base URL and cleanup.
 */

import "@testing-library/jest-dom/vitest"
import { toast } from "@heroui/react"
import { cleanup } from "@testing-library/react"
import type { AnchorHTMLAttributes } from "react"
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

// jsdom lacks matchMedia, which next-themes reads for the system theme (node-environment tests have no window)
if (typeof window !== "undefined") {
  window.matchMedia ??= (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      // Deprecated, but next-themes still subscribes with it
      // noinspection JSDeprecatedSymbols
      addListener: () => undefined,
      // noinspection JSDeprecatedSymbols
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
  // ...and the Web Animations API, which the tab indicator of React Aria waits on
  Element.prototype.getAnimations ??= (): Animation[] => []
}

// The browser resolves "/api/v1/..." against the page; jsdom's Request needs an absolute URL
client.setConfig({ baseUrl: "http://localhost" })
// As in the app (components/Providers.tsx): failed requests throw ApiError
installApiErrors()

vi.mock("@/i18n/navigation", () => ({
  // jsdom cannot navigate: the click is recorded as router.push, as the real Link does on the client
  Link: ({ href, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
        router.push(href)
      }}
      {...props}
    >
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => navigation.pathname,
  getPathname: ({ href }: { href: string }) => href,
  redirect: vi.fn(),
}))

// Server-side next-intl: translations come from the English messages, the locale is English unless a test says otherwise
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  const { default: messages } = await import("../messages/en.json")
  return {
    getTranslations: async (options?: string | { namespace?: string }) =>
      createTranslator({
        locale: "en",
        messages,
        namespace: (typeof options === "string" ? options : options?.namespace) as never,
      }),
    getLocale: vi.fn(async () => "en"),
    getRequestConfig: <T,>(factory: T): T => factory,
  }
})

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.searchParams,
  usePathname: () => navigation.pathname,
  useRouter: () => router,
  notFound: vi.fn(),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}))

afterEach((): void => {
  // The toast queue is global: without this, one test's toasts show up in the next
  toast.clear()
  cleanup()
  vi.restoreAllMocks()
  router.push.mockReset()
  router.replace.mockReset()
  router.refresh.mockReset()
  navigation.pathname = "/"
  navigation.searchParams = new URLSearchParams()
})
