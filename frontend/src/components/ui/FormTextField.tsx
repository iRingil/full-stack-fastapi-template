/**
 * @file A HeroUI text field bound to a react-hook-form field (value, blur, error message).
 */

import { Description, FieldError, Input, Label, TextArea, TextField } from "@heroui/react"
import type { ReactNode } from "react"
import { type Control, type FieldPath, type FieldValues, useController } from "react-hook-form"
import { useFieldVariant } from "./FieldVariant"

export type FormTextFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  type?: "text" | "email"
  autoComplete?: string
  placeholder?: string
  description?: string
  isRequired?: boolean
  isDisabled?: boolean
  /** Renders a multi-line text area instead of an input. */
  multiline?: boolean
  /** Focus the field when it appears (the first field of a dialog). */
  autoFocus?: boolean
}

/**
 * Renders the field; validation comes from the form's resolver, so the field itself does not validate.
 * @param props - The form control, field name and presentation.
 * @returns The field.
 */
export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  description,
  isRequired,
  isDisabled,
  multiline,
  autoFocus,
}: FormTextFieldProps<T>): ReactNode {
  const { field, fieldState } = useController({ control, name })
  const variant = useFieldVariant()
  return (
    <TextField
      fullWidth
      name={field.name}
      type={type}
      value={field.value ?? ""}
      onChange={field.onChange}
      onBlur={field.onBlur}
      isInvalid={fieldState.invalid}
      isRequired={isRequired}
      isDisabled={isDisabled ?? field.disabled}
      autoFocus={autoFocus}
      validationBehavior="aria"
    >
      <Label>{label}</Label>
      {multiline ? (
        <TextArea ref={field.ref} variant={variant} placeholder={placeholder} rows={3} />
      ) : (
        <Input ref={field.ref} variant={variant} placeholder={placeholder} autoComplete={autoComplete} />
      )}
      {description ? <Description>{description}</Description> : null}
      <FieldError>{fieldState.error?.message}</FieldError>
    </TextField>
  )
}
