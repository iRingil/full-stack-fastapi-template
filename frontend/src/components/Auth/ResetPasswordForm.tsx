/**
 * @file Sets a new password with the token from the emailed link (`/reset-password?token=...`).
 */

"use client"

import { Button } from "@heroui/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { resetPasswordMutation } from "@/client/@tanstack/react-query.gen"
import { FormAlert } from "@/components/ui/FormAlert"
import { FormPasswordField } from "@/components/ui/FormPasswordField"
import { LinkButton } from "@/components/ui/LinkButton"
import { Link } from "@/i18n/navigation"
import { errorMessage } from "@/lib/api-error"
import { resetPasswordSchema } from "@/lib/validation"
import { AuthCard } from "./AuthCard"

/**
 * Renders the form; without a token it points to the recovery page instead.
 * @returns The form in its card.
 */
export function ResetPasswordForm(): ReactNode {
  const t = useTranslations("ResetPassword")
  const tc = useTranslations("Common")
  const tv = useTranslations("Validation")
  const token: string | null = useSearchParams().get("token")
  const reset = useMutation(resetPasswordMutation())
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema(tv)),
    defaultValues: { newPassword: "", confirmPassword: "" },
  })

  if (!token) {
    return (
      <AuthCard title={t("invalidTitle")} description={t("invalidDescription")}>
        <LinkButton href="/recover-password" fullWidth>
          {t("requestNew")}
        </LinkButton>
      </AuthCard>
    )
  }

  if (reset.isSuccess) {
    return (
      <AuthCard title={t("successTitle")} description={t("successDescription")}>
        <LinkButton href="/login" fullWidth>
          {t("toLogin")}
        </LinkButton>
      </AuthCard>
    )
  }

  const onSubmit = handleSubmit(async ({ newPassword }): Promise<void> => {
    try {
      await reset.mutateAsync({ body: { token, new_password: newPassword } })
    } catch (error) {
      setError("root", { message: errorMessage(error, tc("errorGeneric")) })
    }
  })

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <Link href="/recover-password" className="link">
          {t("requestNew")}
        </Link>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
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
        <Button type="submit" fullWidth isPending={isSubmitting}>
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  )
}
