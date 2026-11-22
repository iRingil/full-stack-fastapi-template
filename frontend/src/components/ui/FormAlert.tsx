/**
 * @file An alert above a form's buttons: the form-level error (react-hook-form's `errors.root`) or a notice.
 */

import { Alert } from "@heroui/react"
import type { ReactNode } from "react"

export type FormAlertProps = {
  status?: "danger" | "success" | "accent" | "warning"
  title?: string
  children?: ReactNode
}

/**
 * Renders the alert, nothing without content.
 * @description An error is announced by screen readers at once (`role="alert"`), a notice politely (`role="status"`).
 * @param props - The status, title and text.
 * @returns The alert.
 */
export function FormAlert({ status = "danger", title, children }: FormAlertProps): ReactNode {
  if (!title && !children) {
    return null
  }
  return (
    <Alert status={status} role={status === "danger" ? "alert" : "status"}>
      <Alert.Indicator />
      <Alert.Content>
        {title ? <Alert.Title>{title}</Alert.Title> : null}
        {children ? <Alert.Description>{children}</Alert.Description> : null}
      </Alert.Content>
    </Alert>
  )
}
