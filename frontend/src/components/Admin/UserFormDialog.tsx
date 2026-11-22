/**
 * @file The admin's user form in a dialog, shared by "add" and "edit".
 */

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect } from "react"
import { useForm } from "react-hook-form"
import type { UserPublic } from "@/client/types.gen"
import { FormDialog } from "@/components/ui/FormDialog"
import { FormPasswordField } from "@/components/ui/FormPasswordField"
import { FormSwitch } from "@/components/ui/FormSwitch"
import { FormTextField } from "@/components/ui/FormTextField"
import { userSchema } from "@/lib/validation"

/** The form values; an empty password keeps the current one when editing. */
export type UserFormValues = {
  email: string
  fullName: string
  password: string
  confirmPassword: string
  isSuperuser: boolean
  isActive: boolean
}

export type UserFormDialogProps = {
  isOpen: boolean
  onClose: () => void
  /** The user to edit; a new user when absent. */
  user?: UserPublic
  title: string
  submitLabel: string
  onSubmit: (values: UserFormValues) => Promise<void>
}

/**
 * Fills the form from a user (or with the defaults of a new one).
 * @param user - The user to edit, if any.
 * @returns The form values.
 */
export function userFormValues(user?: UserPublic): UserFormValues {
  return {
    email: user?.email ?? "",
    fullName: user?.full_name ?? "",
    password: "",
    confirmPassword: "",
    isSuperuser: user?.is_superuser ?? false,
    isActive: user?.is_active ?? true,
  }
}

/**
 * Renders the dialog; the form is refilled from `user` every time it opens.
 * @param props - The state, texts, the user and the save action (it throws on failure, the dialog stays open).
 * @returns The dialog.
 */
export function UserFormDialog({
  isOpen,
  onClose,
  user,
  title,
  submitLabel,
  onSubmit,
}: UserFormDialogProps): ReactNode {
  const t = useTranslations("Admin")
  const tc = useTranslations("Common")
  const tv = useTranslations("Validation")
  const isNew: boolean = user === undefined
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<UserFormValues>({ resolver: zodResolver(userSchema(tv, isNew)), defaultValues: userFormValues() })

  useEffect((): void => {
    if (isOpen) {
      reset(userFormValues(user))
    }
  }, [isOpen, user, reset])

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      submitLabel={submitLabel}
      isPending={isSubmitting}
      onSubmit={handleSubmit(async (values: UserFormValues): Promise<void> => {
        try {
          await onSubmit(values)
          onClose()
        } catch {
          // The caller has shown the error; the dialog stays open with the entered values
        }
      })}
    >
      <FormTextField
        control={control}
        name="email"
        type="email"
        label={tc("email")}
        autoComplete="off"
        isRequired
        autoFocus
      />
      <FormTextField control={control} name="fullName" label={tc("fullName")} autoComplete="off" />
      <FormPasswordField
        control={control}
        name="password"
        label={isNew ? tc("password") : t("newPasswordOptional")}
        autoComplete="new-password"
        isRequired={isNew}
      />
      <FormPasswordField
        control={control}
        name="confirmPassword"
        label={tc("confirmPassword")}
        autoComplete="new-password"
        isRequired={isNew}
      />
      <FormSwitch control={control} name="isSuperuser" label={t("superuser")} description={t("superuserHint")} />
      <FormSwitch control={control} name="isActive" label={t("active")} description={t("activeHint")} />
    </FormDialog>
  )
}
