/**
 * @file The sign-up form; the backend then emails a link that confirms the address.
 * @description The backend answers the same for a new and for an already registered email (it must not reveal
 * registered addresses), so the message after the form covers both cases.
 */

"use client"

import { Button } from "@heroui/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { registerUserMutation } from "@/client/@tanstack/react-query.gen"
import { FormAlert } from "@/components/ui/FormAlert"
import { FormPasswordField } from "@/components/ui/FormPasswordField"
import { FormTextField } from "@/components/ui/FormTextField"
import { LinkButton } from "@/components/ui/LinkButton"
import { useErrorMessage } from "@/hooks/useErrorMessage"
import { Link } from "@/i18n/navigation"
import { emptyToNull, signUpSchema } from "@/lib/validation"
import { AuthCard } from "./AuthCard"

/**
 * Renders the form, or the "check your email" message after a successful sign-up.
 * @returns The form in its card.
 */
export function SignUpForm(): ReactNode {
  const t = useTranslations("SignUp")
  const tc = useTranslations("Common")
  const tv = useTranslations("Validation")
  const signUp = useMutation(registerUserMutation())
  const errorMessage = useErrorMessage()
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signUpSchema(tv)),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  })

  const onSubmit = handleSubmit(async (values): Promise<void> => {
    try {
      await signUp.mutateAsync({
        body: { email: values.email, password: values.password, full_name: emptyToNull(values.fullName) },
      })
    } catch (error) {
      setError("root", { message: errorMessage(error) })
    }
  })

  if (signUp.isSuccess) {
    return (
      <AuthCard title={t("successTitle")} description={t("successDescription", { email: signUp.variables.body.email })}>
        <LinkButton href="/login" fullWidth>
          {t("toLogin")}
        </LinkButton>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <span>
          {t("haveAccount")}{" "}
          <Link href="/login" className="link">
            {t("login")}
          </Link>
        </span>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormTextField control={control} name="fullName" label={tc("fullName")} autoComplete="name" />
        <FormTextField
          control={control}
          name="email"
          type="email"
          label={tc("email")}
          autoComplete="email"
          isRequired
        />
        <FormPasswordField
          control={control}
          name="password"
          label={tc("password")}
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
