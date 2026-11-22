/**
 * @file Hook that turns a failed request into a message in the user's language.
 */

import { useTranslations } from "next-intl"
import { errorKey } from "@/lib/api-error"

/**
 * Translates request errors.
 * @returns A function from an error (anything thrown by a query or mutation) to its translated message.
 */
export function useErrorMessage(): (error: unknown) => string {
  const t = useTranslations("Errors")
  return (error: unknown): string => t(errorKey(error))
}
