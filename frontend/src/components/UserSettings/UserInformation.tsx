/**
 * @file Settings tab "My profile": the user's name and email.
 * @description Changing the email asks for the current password (the backend requires it): the address is what
 * the password is recovered through.
 */

import { Button } from "@heroui/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect } from "react"
import { useForm } from "react-hook-form"
import { readUserMeQueryKey, updateUserMeMutation } from "@/client/@tanstack/react-query.gen"
import { FormPasswordField } from "@/components/ui/FormPasswordField"
import { FormTextField } from "@/components/ui/FormTextField"
import { useCurrentUser } from "@/hooks/useAuth"
import { useNotify } from "@/hooks/useNotify"
import { emptyToNull, isSameEmail, profileSchema } from "@/lib/validation"

/**
 * Renders the profile form.
 * @returns The form.
 */
export function UserInformation(): ReactNode {
  const t = useTranslations("Settings")
  const tc = useTranslations("Common")
  const tv = useTranslations("Validation")
  const notify = useNotify()
  const queryClient: QueryClient = useQueryClient()
  const { data: user } = useCurrentUser()
  const updateMe = useMutation({
    ...updateUserMeMutation(),
    onSuccess: (updated): void => {
      queryClient.setQueryData(readUserMeQueryKey(), updated)
      notify.success(t("profileSaved"))
    },
    onError: notify.error,
  })
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema(tv, user?.email ?? "")),
    defaultValues: { fullName: "", email: "", currentPassword: "" },
  })
  const isEmailChanged: boolean = !isSameEmail(watch("email"), user?.email ?? "")

  useEffect((): void => {
    if (user) {
      reset({ fullName: user.full_name ?? "", email: user.email, currentPassword: "" })
    }
  }, [user, reset])

  const onSubmit = handleSubmit(async (values): Promise<void> => {
    try {
      await updateMe.mutateAsync({
        body: {
          full_name: emptyToNull(values.fullName),
          email: values.email,
          current_password: isEmailChanged ? values.currentPassword : undefined,
        },
      })
    } catch {
      // Shown by the toast; the form keeps the entered values
    }
  })

  return (
    <form method="post" noValidate onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <FormTextField control={control} name="fullName" label={tc("fullName")} autoComplete="name" />
      <FormTextField
        control={control}
        name="email"
        type="email"
        label={tc("email")}
        autoComplete="email"
        isRequired
        description={t("emailHint")}
      />
      {isEmailChanged ? (
        <FormPasswordField
          control={control}
          name="currentPassword"
          label={t("currentPassword")}
          description={t("currentPasswordHint")}
          autoComplete="current-password"
          isRequired
        />
      ) : null}
      <Button type="submit" className="self-start" isPending={isSubmitting} isDisabled={!isDirty}>
        {tc("save")}
      </Button>
    </form>
  )
}
