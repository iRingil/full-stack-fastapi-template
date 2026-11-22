/**
 * @file Create, update and delete items; each refreshes the item lists and reports the result in a toast.
 */

import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  createItemMutation,
  deleteItemMutation,
  readItemsQueryKey,
  updateItemMutation,
} from "@/client/@tanstack/react-query.gen"
import type { ItemFormValues } from "@/components/Items/ItemFormDialog"
import { emptyToNull } from "@/lib/validation"
import { useNotify } from "./useNotify"

/**
 * The item mutations.
 * @returns `create(values)`, `update(id, values)`, `remove(id)` (each throws on failure after the error toast) and
 * whether a deletion is running.
 */
export function useItemMutations(): {
  create: (values: ItemFormValues) => Promise<void>
  update: (id: string, values: ItemFormValues) => Promise<void>
  remove: (id: string) => Promise<void>
  isRemoving: boolean
} {
  const t = useTranslations("Items")
  const notify = useNotify()
  const queryClient: QueryClient = useQueryClient()
  // Spread into the useMutation options below
  // noinspection JSUnusedGlobalSymbols
  const callbacks = {
    onError: notify.error,
    onSettled: (): Promise<void> => queryClient.invalidateQueries({ queryKey: readItemsQueryKey() }),
  }
  const createItem = useMutation({
    ...createItemMutation(),
    ...callbacks,
    onSuccess: () => notify.success(t("created")),
  })
  const updateItem = useMutation({
    ...updateItemMutation(),
    ...callbacks,
    onSuccess: () => notify.success(t("updated")),
  })
  const deleteItem = useMutation({
    ...deleteItemMutation(),
    ...callbacks,
    onSuccess: () => notify.success(t("deleted")),
  })

  const body = (values: ItemFormValues) => ({ title: values.title, description: emptyToNull(values.description) })

  return {
    create: async (values: ItemFormValues): Promise<void> => {
      await createItem.mutateAsync({ body: body(values) })
    },
    update: async (id: string, values: ItemFormValues): Promise<void> => {
      await updateItem.mutateAsync({ path: { id }, body: body(values) })
    },
    remove: async (id: string): Promise<void> => {
      await deleteItem.mutateAsync({ path: { id } })
    },
    isRemoving: deleteItem.isPending,
  }
}
