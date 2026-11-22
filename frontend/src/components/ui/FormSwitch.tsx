/**
 * @file A HeroUI switch bound to a boolean react-hook-form field.
 */

import { Description, Switch } from "@heroui/react"
import type { ReactNode } from "react"
import { type Control, type FieldPath, type FieldValues, useController } from "react-hook-form"

export type FormSwitchProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
}

/**
 * Renders the switch.
 * @param props - The form control, field name and presentation.
 * @returns The switch.
 */
export function FormSwitch<T extends FieldValues>({
  control,
  name,
  label,
  description,
}: FormSwitchProps<T>): ReactNode {
  const { field } = useController({ control, name })
  return (
    <Switch name={field.name} isSelected={Boolean(field.value)} onChange={field.onChange} isDisabled={field.disabled}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {label}
      </Switch.Content>
      {description ? <Description>{description}</Description> : null}
    </Switch>
  )
}
