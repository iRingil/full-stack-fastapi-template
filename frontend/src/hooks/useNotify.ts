/**
 * @file Toast notifications with the app's wording.
 */

import { toast } from "@heroui/react"
import { useTranslations } from "next-intl"
import { isUnauthorized } from "@/lib/query-client"
import { useErrorMessage } from "./useErrorMessage"

/**
 * Shows success and error toasts.
 * @returns `success(message)` and `error(error)`; the latter shows the backend's message or a generic one.
 */
export function useNotify(): { success: (message: string) => void; error: (error: unknown) => void } {
  const t = useTranslations("Common")
  const errorMessage = useErrorMessage()
  return {
    success: (message: string): void => {
      toast.success(message)
    },
    error: (error: unknown): void => {
      // A 401 already logs the user out, a toast on top would only confuse
      if (!isUnauthorized(error)) {
        toast.danger(t("errorTitle"), { description: errorMessage(error) })
      }
    },
  }
}
