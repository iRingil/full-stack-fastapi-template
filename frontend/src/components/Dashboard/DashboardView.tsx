/**
 * @file The dashboard: a greeting and, until the email is confirmed, a notice with "send the link again".
 */

"use client"

import { Alert, Button, Skeleton } from "@heroui/react"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { resendVerificationEmailMutation } from "@/client/@tanstack/react-query.gen"
import { useCurrentUser } from "@/hooks/useAuth"
import { useNotify } from "@/hooks/useNotify"

/**
 * Renders the page content.
 * @returns The greeting and the notices.
 */
export function DashboardView(): ReactNode {
  const t = useTranslations("Dashboard")
  const notify = useNotify()
  const { data: user } = useCurrentUser()
  const resend = useMutation({
    ...resendVerificationEmailMutation(),
    onSuccess: (): void => notify.success(t("verificationSent")),
    onError: notify.error,
  })

  if (!user) {
    return <Skeleton className="h-8 w-72 rounded-lg" />
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="truncate text-2xl font-semibold">{t("greeting", { name: user.full_name || user.email })}</h1>
        <p className="mt-1 text-muted">{t("welcome")}</p>
      </div>
      {user.is_email_verified ? null : (
        <Alert status="warning" className="max-w-2xl">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("unverifiedTitle")}</Alert.Title>
            <Alert.Description>{t("unverifiedDescription", { email: user.email })}</Alert.Description>
          </Alert.Content>
          <Button
            size="sm"
            variant="secondary"
            isPending={resend.isPending}
            isDisabled={resend.isSuccess}
            onPress={(): void => resend.mutate({ body: { email: user.email } })}
          >
            {t("resend")}
          </Button>
        </Alert>
      )}
    </section>
  )
}
