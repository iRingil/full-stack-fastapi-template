/**
 * @file "Forgot password": asks the backend to email a password reset link.
 * @description The answer is the same whether or not the account exists, so the form does not reveal registered
 * emails (the backend answers 404 for an unknown one).
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
import { Link } from "@/i18n/navigation"
import { ApiError, errorMessage } from "@/lib/api-error"
import { emailSchema } from "@/lib/validation"
import { AuthCard } from "./AuthCard"

/**
 * Requests the reset email; an unknown address counts as success.
 * @param email - The address.
 * @returns Nothing.
 * @throws {ApiError} For any other failure.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await recoverPassword({ path: { email }, throwOnError: true })
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      throw error
    }
  }
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
      setError("root", { message: errorMessage(error, tc("errorGeneric")) })
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
