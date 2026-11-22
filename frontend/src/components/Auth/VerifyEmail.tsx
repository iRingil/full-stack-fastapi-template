/**
 * @file Confirms the email address with the token from the emailed link (`/verify-email?token=...`).
 * @description The token is sent once on open. If it is missing, invalid or expired, the visitor can ask for a new
 * link.
 */

"use client"

import { Button, Spinner } from "@heroui/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import {
  readUserMeQueryKey,
  resendVerificationEmailMutation,
  verifyEmailMutation,
} from "@/client/@tanstack/react-query.gen"
import { FormAlert } from "@/components/ui/FormAlert"
import { FormTextField } from "@/components/ui/FormTextField"
import { LinkButton } from "@/components/ui/LinkButton"
import { useErrorMessage } from "@/hooks/useErrorMessage"
import { emailSchema } from "@/lib/validation"
import { AuthCard } from "./AuthCard"

/**
 * The form that requests a new verification link.
 * @returns The form.
 */
export function ResendVerificationForm(): ReactNode {
  const t = useTranslations("VerifyEmail")
  const tc = useTranslations("Common")
  const tv = useTranslations("Validation")
  const resend = useMutation(resendVerificationEmailMutation())
  const errorMessage = useErrorMessage()
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(emailSchema(tv)), defaultValues: { email: "" } })

  if (resend.isSuccess) {
    return <FormAlert status="success">{t("resent")}</FormAlert>
  }

  const onSubmit = handleSubmit(async ({ email }): Promise<void> => {
    try {
      await resend.mutateAsync({ body: { email } })
    } catch (error) {
      setError("root", { message: errorMessage(error) })
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormTextField control={control} name="email" type="email" label={tc("email")} autoComplete="email" isRequired />
      <FormAlert>{errors.root?.message}</FormAlert>
      <Button type="submit" variant="secondary" fullWidth isPending={isSubmitting}>
        {t("resend")}
      </Button>
    </form>
  )
}

/**
 * Renders the verification result.
 * @returns The result in its card.
 */
export function VerifyEmail(): ReactNode {
  const t = useTranslations("VerifyEmail")
  const queryClient: QueryClient = useQueryClient()
  const token: string | null = useSearchParams().get("token")
  const errorMessage = useErrorMessage()
  const verify = useMutation({
    ...verifyEmailMutation(),
    // A logged-in user's cached profile still says "not verified"
    onSuccess: (): Promise<void> => queryClient.invalidateQueries({ queryKey: readUserMeQueryKey() }),
  })
  const sentToken = useRef<string | null>(null)

  useEffect((): void => {
    // Once per token: React runs effects twice in development, a second request would fail on the used token
    if (token && sentToken.current !== token) {
      sentToken.current = token
      verify.mutate({ body: { token } })
    }
  }, [token, verify])

  if (verify.isSuccess) {
    return (
      <AuthCard title={t("successTitle")} description={t("successDescription")}>
        <LinkButton href="/dashboard" fullWidth>
          {t("continue")}
        </LinkButton>
      </AuthCard>
    )
  }
  if (token && !verify.isError) {
    return (
      <AuthCard title={t("pendingTitle")}>
        <div className="flex justify-center py-4">
          <Spinner aria-label={t("pendingTitle")} />
        </div>
      </AuthCard>
    )
  }
  return (
    <AuthCard title={t("failedTitle")} description={token ? errorMessage(verify.error) : t("missingToken")}>
      <ResendVerificationForm />
    </AuthCard>
  )
}
