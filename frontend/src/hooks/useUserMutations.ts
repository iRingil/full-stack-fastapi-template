/**
 * @file The admin's create, update and delete of users; each refreshes the user lists and reports in a toast.
 */

"use client"

import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  createUserMutation,
  deleteUserMutation,
  readUserMeQueryKey,
  readUsersQueryKey,
  updateUserMutation,
} from "@/client/@tanstack/react-query.gen"
import type { UserFormValues } from "@/components/Admin/UserFormDialog"
import { emptyToNull } from "@/lib/validation"
import { useNotify } from "./useNotify"

/**
 * The user mutations.
 * @returns `create(values)`, `update(id, values)`, `remove(id)` (each throws on failure after the error toast) and
 * whether a deletion is running.
 */
export function useUserMutations(): {
  create: (values: UserFormValues) => Promise<void>
  update: (id: string, values: UserFormValues) => Promise<void>
  remove: (id: string) => Promise<void>
  isRemoving: boolean
} {
  const t = useTranslations("Admin")
  const notify = useNotify()
  const queryClient: QueryClient = useQueryClient()
  // noinspection JSUnusedGlobalSymbols - spread into the useMutation options below
  const callbacks = {
    onError: notify.error,
    onSettled: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: readUsersQueryKey() })
      // The admin may have edited their own name or email
      await queryClient.invalidateQueries({ queryKey: readUserMeQueryKey() })
    },
  }
  const createUser = useMutation({
    ...createUserMutation(),
    ...callbacks,
    onSuccess: () => notify.success(t("created")),
  })
  const updateUser = useMutation({
    ...updateUserMutation(),
    ...callbacks,
    onSuccess: () => notify.success(t("updated")),
  })
  const deleteUser = useMutation({
    ...deleteUserMutation(),
    ...callbacks,
    onSuccess: () => notify.success(t("deleted")),
  })

  return {
    create: async (values: UserFormValues): Promise<void> => {
      await createUser.mutateAsync({
        body: {
          email: values.email,
          full_name: emptyToNull(values.fullName),
          password: values.password,
          is_superuser: values.isSuperuser,
          is_active: values.isActive,
        },
      })
    },
    update: async (id: string, values: UserFormValues): Promise<void> => {
      await updateUser.mutateAsync({
        path: { id },
        body: {
          email: values.email,
          full_name: emptyToNull(values.fullName),
          // An empty password field keeps the current password
          ...(values.password ? { password: values.password } : {}),
          is_superuser: values.isSuperuser,
          is_active: values.isActive,
        },
      })
    },
    remove: async (id: string): Promise<void> => {
      await deleteUser.mutateAsync({ path: { id } })
    },
    isRemoving: deleteUser.isPending,
  }
}
