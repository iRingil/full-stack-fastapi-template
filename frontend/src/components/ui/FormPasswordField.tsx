/**
 * @file A password field bound to react-hook-form, with a show/hide toggle.
 */

"use client"

import { Button, FieldError, InputGroup, Label, TextField } from "@heroui/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { type Control, type FieldPath, type FieldValues, useController } from "react-hook-form"
import { FiEye, FiEyeOff } from "react-icons/fi"
import { useFieldVariant } from "./FieldVariant"

export type FormPasswordFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  /** "current-password" on login, "new-password" when the password is set. */
  autoComplete: "current-password" | "new-password"
  isRequired?: boolean
}

/**
 * Renders the field.
 * @param props - The form control, field name and presentation.
 * @returns The field.
 */
export function FormPasswordField<T extends FieldValues>({
  control,
  name,
  label,
  autoComplete,
  isRequired,
}: FormPasswordFieldProps<T>): ReactNode {
  const t = useTranslations("Common")
  const { field, fieldState } = useController({ control, name })
  const variant = useFieldVariant()
  const [isVisible, setIsVisible] = useState<boolean>(false)
  return (
    <TextField
      fullWidth
      name={field.name}
      type={isVisible ? "text" : "password"}
      value={field.value ?? ""}
      onChange={field.onChange}
      onBlur={field.onBlur}
      isInvalid={fieldState.invalid}
      isRequired={isRequired}
      isDisabled={field.disabled}
      validationBehavior="aria"
    >
      <Label>{label}</Label>
      <InputGroup fullWidth variant={variant}>
        <InputGroup.Input ref={field.ref} autoComplete={autoComplete} />
        <InputGroup.Suffix className="pe-0">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={isVisible ? t("hidePassword") : t("showPassword")}
            onPress={(): void => setIsVisible(!isVisible)}
          >
            {isVisible ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      <FieldError>{fieldState.error?.message}</FieldError>
    </TextField>
  )
}
