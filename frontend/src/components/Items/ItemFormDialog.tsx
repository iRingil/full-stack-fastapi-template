/**
 * @file The item form in a dialog, shared by "add" and "edit".
 */

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect } from "react"
import { useForm } from "react-hook-form"
import type { ItemPublic } from "@/client/types.gen"
import { FormDialog } from "@/components/ui/FormDialog"
import { FormTextField } from "@/components/ui/FormTextField"
import { itemSchema } from "@/lib/validation"

/** The form values; the description is "" in the form and null in the API. */
export type ItemFormValues = { title: string; description: string }

export type ItemFormDialogProps = {
  isOpen: boolean
  onClose: () => void
  /** The item to edit; a new item when absent. */
  item?: ItemPublic
  title: string
  submitLabel: string
  onSubmit: (values: ItemFormValues) => Promise<void>
}

/**
 * Renders the dialog; the form is refilled from `item` every time it opens.
 * @param props - The state, texts, the item and the save action (it throws on failure, the dialog stays open).
 * @returns The dialog.
 */
export function ItemFormDialog({
  isOpen,
  onClose,
  item,
  title,
  submitLabel,
  onSubmit,
}: ItemFormDialogProps): ReactNode {
  const t = useTranslations("Items")
  const tv = useTranslations("Validation")
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({ resolver: zodResolver(itemSchema(tv)), defaultValues: { title: "", description: "" } })

  useEffect((): void => {
    if (isOpen) {
      reset({ title: item?.title ?? "", description: item?.description ?? "" })
    }
  }, [isOpen, item, reset])

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      submitLabel={submitLabel}
      isPending={isSubmitting}
      onSubmit={handleSubmit(async (values: ItemFormValues): Promise<void> => {
        try {
          await onSubmit(values)
          onClose()
        } catch {
          // The caller has shown the error; the dialog stays open with the entered values
        }
      })}
    >
      <FormTextField control={control} name="title" label={t("itemTitle")} isRequired autoFocus />
      <FormTextField control={control} name="description" label={t("itemDescription")} multiline />
    </FormDialog>
  )
}
