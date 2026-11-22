/**
 * @file The TanStack Query client of the app.
 */

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { ApiError } from "./api-error"

/**
 * Checks whether a request failed because the token is missing, expired or revoked.
 * @param error - Anything thrown by a query or mutation.
 * @returns True for a 401 from the backend.
 */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

/**
 * Creates the query client.
 * @param onUnauthorized - Called when any query or mutation gets a 401 (the session is over).
 * @param onQuerySuccess - Called when a query succeeds (after a new login, the session works again).
 * @returns The client.
 */
export function createQueryClient(
  onUnauthorized: () => void,
  onQuerySuccess: () => void = () => undefined,
): QueryClient {
  const handleError = (error: unknown): void => {
    if (isUnauthorized(error)) {
      onUnauthorized()
    }
  }
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError, onSuccess: onQuerySuccess }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // Repeating a request does not help with 4xx answers
        retry: (failureCount: number, error: unknown): boolean =>
          failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
  })
}
