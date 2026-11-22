/**
 * @file "Forgot password": asks the backend to email a password reset link.
 * @description The backend answers the same whether the account exists, so the form does not reveal
 * registered emails. The address is sent in the request body: URLs end up in access logs.
 */

"use client"

import { Button } from "@heroui/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { recoverPassword } from "@/client/sdk.gen"
import { FormAlert } from "@/components/ui/FormAlert"
import { FormTextField } from "@/components/ui/FormTextField"
import { useErrorMessage } from "@/hooks/useErrorMessage"
import { Link } from "@/i18n/navigation"
import { emailSchema } from "@/lib/validation"
import { AuthCard } from "./AuthCard"

/**
 * Requests the reset email.
 * @param email - The address.
 * @returns Nothing.
 * @throws {ApiError} If the request fails.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await recoverPassword({ body: { email }, throwOnError: true })
}

/**
 * Renders the form, or the "check your email" message after sending.
 * @returns The form in its card.
 */
export function RecoverPasswordForm(): ReactNode {
  const t = useTranslations("RecoverPassword")
  const tc = useTranslations("Common")
  const tv = useTranslations("Validation")
  const recover = useMutation({ mutationFn: requestPasswordReset })
  const errorMessage = useErrorMessage()
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(emailSchema(tv)), defaultValues: { email: "" } })

  const onSubmit = handleSubmit(async ({ email }): Promise<void> => {
    try {
      await recover.mutateAsync(email)
    } catch (error) {
      setError("root", { message: errorMessage(error) })
    }
  })

  const footer: ReactNode = (
    <Link href="/login" className="link">
      {t("backToLogin")}
    </Link>
  )

  if (recover.isSuccess) {
    return <AuthCard title={t("successTitle")} description={t("successDescription")} footer={footer} />
  }

  return (
    <AuthCard title={t("title")} description={t("description")} footer={footer}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormTextField
          control={control}
          name="email"
          type="email"
          label={tc("email")}
          autoComplete="email"
          isRequired
        />
        <FormAlert>{errors.root?.message}</FormAlert>
        <Button type="submit" fullWidth isPending={isSubmitting}>
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  )
}
