/**
 * @file Settings tab "Password": changes the password, the current one is required.
 */

"use client"

import { Button } from "@heroui/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { updatePasswordMeMutation } from "@/client/@tanstack/react-query.gen"
import { FormAlert } from "@/components/ui/FormAlert"
import { FormPasswordField } from "@/components/ui/FormPasswordField"
import { useNotify } from "@/hooks/useNotify"
import { errorMessage } from "@/lib/api-error"
import { changePasswordSchema } from "@/lib/validation"

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" }

/**
 * Renders the password form.
 * @returns The form.
 */
export function ChangePassword(): ReactNode {
  const t = useTranslations("Settings")
  const tc = useTranslations("Common")
  const tv = useTranslations("Validation")
  const notify = useNotify()
  const updatePassword = useMutation(updatePasswordMeMutation())
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(changePasswordSchema(tv)), defaultValues: EMPTY })

  const onSubmit = handleSubmit(async (values): Promise<void> => {
    try {
      await updatePassword.mutateAsync({
        body: { current_password: values.currentPassword, new_password: values.newPassword },
      })
      reset(EMPTY)
      notify.success(t("passwordChanged"))
    } catch (error) {
      // "Incorrect password" and the like belong next to the form, not in a toast
      setError("root", { message: errorMessage(error, tc("errorGeneric")) })
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <FormPasswordField
        control={control}
        name="currentPassword"
        label={t("currentPassword")}
        autoComplete="current-password"
        isRequired
      />
      <FormPasswordField
        control={control}
        name="newPassword"
        label={tc("newPassword")}
        autoComplete="new-password"
        isRequired
      />
      <FormPasswordField
        control={control}
        name="confirmPassword"
        label={tc("confirmPassword")}
        autoComplete="new-password"
        isRequired
      />
      <FormAlert>{errors.root?.message}</FormAlert>
      <Button type="submit" className="self-start" isPending={isSubmitting}>
        {t("changePassword")}
      </Button>
    </form>
  )
}
