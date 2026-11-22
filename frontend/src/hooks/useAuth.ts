/**
 * @file Login, logout and the current user.
 */

import {
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { readUserMeOptions } from "@/client/@tanstack/react-query.gen"
import type { UserPublic } from "@/client/types.gen"
import { useRouter } from "@/i18n/navigation"
import { type Credentials, requestLogin, requestLogout, requestSession } from "@/lib/auth-client"
import { LOGIN_PATH } from "@/lib/paths"

/**
 * The logged-in user, from `GET /users/me` (cached; invalidate it after the user changes their profile).
 * @returns The query: `data` is the user once loaded.
 */
export function useCurrentUser(): UseQueryResult<UserPublic> {
  return useQuery(readUserMeOptions())
}

/**
 * Whether the visitor is logged in, for the public pages (static, so the server cannot tell). Login and logout clear
 * the cache, so the answer is kept until then.
 * @returns The query: `data` is undefined until known, then true or false.
 */
export function useSession(): UseQueryResult<boolean> {
  return useQuery({ queryKey: ["session"], queryFn: requestSession, staleTime: Number.POSITIVE_INFINITY })
}

/**
 * Login and logout. Both drop all cached data, so nothing of the previous user remains.
 * @returns The login mutation (navigate after its success yourself) and the logout function.
 */
export function useAuth(): {
  login: UseMutationResult<void, unknown, Credentials>
  logout: () => Promise<void>
} {
  const queryClient: QueryClient = useQueryClient()
  const router = useRouter()

  const login: UseMutationResult<void, unknown, Credentials> = useMutation({
    mutationFn: requestLogin,
    onSuccess: (): void => queryClient.clear(),
  })

  const logout = async (): Promise<void> => {
    await requestLogout()
    queryClient.clear()
    router.replace(LOGIN_PATH)
  }

  return { login, logout }
}
