/**
 * @file Whether the page has hydrated.
 * @description A component inside `<Suspense>` hydrates later than the surrounding page, and by then the queries the
 * page started may have data the server-rendered HTML did not have. Content that depends on such data waits for
 * this flag, so that the first client render matches the server's.
 */

import { useSyncExternalStore } from "react"

/** Nothing to subscribe to: the value only changes from the server render to the client one. */
const subscribe = (): (() => void) => () => undefined

/**
 * Tells whether the component renders on the client after hydration.
 * @returns False on the server and while hydrating, true afterward.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    (): boolean => true,
    (): boolean => false,
  )
}
