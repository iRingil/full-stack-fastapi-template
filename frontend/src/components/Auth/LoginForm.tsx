/**
 * @file The login form; after login the user returns to the page that sent them here (`?from=`).
 */

"use client"

import { Button } from "@heroui/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { FormAlert } from "@/components/ui/FormAlert"
import { FormPasswordField } from "@/components/ui/FormPasswordField"
import { FormTextField } from "@/components/ui/FormTextField"
import { useAuth } from "@/hooks/useAuth"
import { useErrorMessage } from "@/hooks/useErrorMessage"
import { Link, useRouter } from "@/i18n/navigation"
import { safeRedirectPath } from "@/lib/paths"
import { loginSchema } from "@/lib/validation"
import { AuthCard } from "./AuthCard"

/**
 * Renders the form.
 * @returns The form in its card.
 */
export function LoginForm(): ReactNode {
  const t = useTranslations("Login")
  const tc = useTranslations("Common")
  const tv = useTranslations("Validation")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const errorMessage = useErrorMessage()
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema(tv)), defaultValues: { username: "", password: "" } })

  const onSubmit = handleSubmit(async (values): Promise<void> => {
    try {
      await login.mutateAsync(values)
      router.replace(safeRedirectPath(searchParams.get("from")))
    } catch (error) {
      setError("root", { message: errorMessage(error) })
    }
  })

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <span>
          {t("noAccount")}{" "}
          <Link href="/signup" className="link">
            {t("signUp")}
          </Link>
        </span>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormTextField
          control={control}
          name="username"
          type="email"
          label={tc("email")}
          autoComplete="email"
          isRequired
        />
        <FormPasswordField
          control={control}
          name="password"
          label={tc("password")}
          autoComplete="current-password"
          isRequired
        />
        <Link href="/recover-password" className="link self-end text-sm">
          {t("forgotPassword")}
        </Link>
        <FormAlert>{errors.root?.message}</FormAlert>
        <Button type="submit" fullWidth isPending={isSubmitting}>
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  )
}
