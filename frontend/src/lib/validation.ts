/**
 * @file Form schemas (zod), with the same limits as the backend models.
 * @description Each factory takes the translator of the "Validation" namespace, so the messages follow the locale.
 */

import { z } from "zod"

/** Field limits of `backend/src/app/models.py`. */
export const LIMITS = { email: 255, fullName: 255, passwordMin: 8, passwordMax: 72, title: 255, description: 255 }

/** Translator of the "Validation" messages. */
export type ValidationT = (
  key: "required" | "email" | "tooLong" | "passwordLength" | "passwordTooLong" | "passwordsMismatch",
) => string

const email = (t: ValidationT) =>
  z
    .string()
    .trim()
    .min(1, { error: t("required") })
    .max(LIMITS.email, { error: t("tooLong") })
    .pipe(z.email({ error: t("email") }))

const password = (t: ValidationT) =>
  z
    .string()
    .min(LIMITS.passwordMin, { error: t("passwordLength") })
    .max(LIMITS.passwordMax, { error: t("passwordLength") })
    // bcrypt takes 72 bytes, and the backend rejects a longer password instead of cutting it
    .refine((value: string): boolean => new TextEncoder().encode(value).length <= LIMITS.passwordMax, {
      error: t("passwordTooLong"),
    })

const fullName = (t: ValidationT) =>
  z
    .string()
    .trim()
    .max(LIMITS.fullName, { error: t("tooLong") })

/**
 * Adds a "confirm password" field that must equal `field`.
 * @param t - The translator.
 * @param shape - The other fields.
 * @param field - The password field to compare with.
 * @returns The schema.
 */
function withConfirmation<S extends z.ZodRawShape>(t: ValidationT, shape: S, field: keyof S & string) {
  return z
    .object({ ...shape, confirmPassword: z.string() })
    .refine((data: Record<string, unknown>): boolean => data[field] === data.confirmPassword, {
      error: t("passwordsMismatch"),
      path: ["confirmPassword"],
    })
}

export const loginSchema = (t: ValidationT) =>
  z.object({ username: email(t), password: z.string().min(1, t("required")) })

export const signUpSchema = (t: ValidationT) =>
  withConfirmation(t, { fullName: fullName(t), email: email(t), password: password(t) }, "password")

export const emailSchema = (t: ValidationT) => z.object({ email: email(t) })

export const resetPasswordSchema = (t: ValidationT) => withConfirmation(t, { newPassword: password(t) }, "newPassword")

export const changePasswordSchema = (t: ValidationT) =>
  withConfirmation(t, { currentPassword: z.string().min(1, t("required")), newPassword: password(t) }, "newPassword")

/**
 * Compares two email addresses the way the backend does: the case does not matter.
 * @param a - An address.
 * @param b - Another address.
 * @returns True when they are the same account.
 */
export function isSameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Schema of the profile form.
 * @param t - The translator of the validation messages.
 * @param currentEmail - The user's email now: another one requires the current password.
 * @returns The schema.
 */
export const profileSchema = (t: ValidationT, currentEmail: string) =>
  z
    .object({ fullName: fullName(t), email: email(t), currentPassword: z.string() })
    .refine(
      (data: { email: string; currentPassword: string }): boolean =>
        isSameEmail(data.email, currentEmail) || data.currentPassword.length > 0,
      { error: t("required"), path: ["currentPassword"] },
    )

export const itemSchema = (t: ValidationT) =>
  z.object({
    title: z
      .string()
      .trim()
      .min(1, { error: t("required") })
      .max(LIMITS.title, { error: t("tooLong") }),
    description: z
      .string()
      .trim()
      .max(LIMITS.description, { error: t("tooLong") }),
  })

/**
 * The admin's user form. A new user needs a password; when editing, an empty password keeps the current one.
 * @param t - The translator.
 * @param isNew - Whether the form creates a user.
 * @returns The schema.
 */
export const userSchema = (t: ValidationT, isNew: boolean) =>
  withConfirmation(
    t,
    {
      email: email(t),
      fullName: fullName(t),
      password: isNew ? password(t) : z.union([z.literal(""), password(t)]),
      isSuperuser: z.boolean(),
      isActive: z.boolean(),
    },
    "password",
  )

/**
 * Turns an empty optional text into null, as the backend stores it.
 * @param value - The trimmed form value.
 * @returns The value, or null when empty.
 */
export function emptyToNull(value: string): string | null {
  return value === "" ? null : value
}
