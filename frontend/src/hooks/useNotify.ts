/**
 * @file Toast notifications with the app's wording.
 */

"use client"

import { toast } from "@heroui/react"
import { useTranslations } from "next-intl"
import { errorMessage } from "@/lib/api-error"
import { isUnauthorized } from "@/lib/query-client"

/**
 * Shows success and error toasts.
 * @returns `success(message)` and `error(error)`; the latter shows the backend's message or a generic one.
 */
export function useNotify(): { success: (message: string) => void; error: (error: unknown) => void } {
  const t = useTranslations("Common")
  return {
    success: (message: string): void => {
      toast.success(message)
    },
    error: (error: unknown): void => {
      // A 401 already logs the user out, a toast on top would only confuse
      if (!isUnauthorized(error)) {
        toast.danger(t("errorTitle"), { description: errorMessage(error, t("errorGeneric")) })
      }
    },
  }
}
