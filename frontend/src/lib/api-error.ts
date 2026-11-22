/**
 * @file Errors of the generated API client.
 * @description The generated fetch client throws the parsed response body as is, without the HTTP status. The error
 * interceptor installed by {@link installApiErrors} turns it into an {@link ApiError}, so callers can react to the
 * status (401 -> log out) and show the backend's `detail` message.
 */

import { client } from "@/client/client.gen"

/** One entry of FastAPI's 422 response (`{"detail": [{"loc": [...], "msg": "..."}]}`). */
type ValidationIssue = { msg?: unknown }

/**
 * Extracts a human-readable message from a FastAPI error body.
 * @param body - The parsed error body: `{"detail": "..."}`, `{"detail": [...]}` or plain text.
 * @returns The message, or undefined when the body carries none.
 */
export function detailMessage(body: unknown): string | undefined {
  if (typeof body === "string") {
    return body.trim() || undefined
  }
  if (typeof body !== "object" || body === null || !("detail" in body)) {
    return undefined
  }
  const { detail } = body
  if (typeof detail === "string") {
    return detail
  }
  if (Array.isArray(detail)) {
    const messages: string[] = detail
      .map((issue: ValidationIssue): unknown => issue?.msg)
      .filter((msg: unknown): msg is string => typeof msg === "string")
    return messages.length > 0 ? messages.join("; ") : undefined
  }
  return undefined
}

/** A failed API request: the HTTP status (0 for a network error) and the backend's message. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string | undefined

  /**
   * @param status - The HTTP status, 0 when no response arrived.
   * @param body - The parsed error body or the original exception.
   */
  constructor(status: number, body: unknown) {
    const detail: string | undefined = status === 0 ? undefined : detailMessage(body)
    super(detail ?? `Request failed with status ${status}`)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }
}

/** Keys of the "Errors" messages: what the user is told about a failed request, in their language. */
export type ErrorKey =
  | "generic"
  | "network"
  | "server"
  | "unavailable"
  | "forbidden"
  | "notFound"
  | "validation"
  | "tooManyRequests"
  | "tooManyLoginAttempts"
  | "incorrectCredentials"
  | "inactiveUser"
  | "incorrectPassword"
  | "samePassword"
  | "commonPassword"
  | "emailTaken"
  | "invalidResetToken"
  | "invalidVerificationToken"
  | "superuserSelfDelete"
  | "superuserSelfLock"

/**
 * The backend's `detail` texts (English, `backend/src/app/api`) that have a message of their own.
 * A text that is not listed falls back to the message of its HTTP status.
 */
const DETAIL_KEYS: Readonly<Record<string, ErrorKey>> = {
  "Incorrect email or password": "incorrectCredentials",
  "Inactive user": "inactiveUser",
  "Too many failed login attempts. Please try again later.": "tooManyLoginAttempts",
  "Incorrect password": "incorrectPassword",
  "New password cannot be the same as the current one": "samePassword",
  "User with this email already exists": "emailTaken",
  "The user with this email already exists in the system.": "emailTaken",
  "Invalid token": "invalidResetToken",
  "Invalid or expired verification token": "invalidVerificationToken",
  "Super users are not allowed to delete themselves": "superuserSelfDelete",
  "Super users are not allowed to deactivate or demote themselves": "superuserSelfLock",
}

const STATUS_KEYS: Readonly<Record<number, ErrorKey>> = {
  0: "network",
  403: "forbidden",
  404: "notFound",
  422: "validation",
  429: "tooManyRequests",
  502: "unavailable",
}

/**
 * Picks the message for a failed request: the backend answers in English, the user reads their own language.
 * @param error - Anything thrown by a query or mutation.
 * @returns The key of the "Errors" message.
 */
export function errorKey(error: unknown): ErrorKey {
  if (!(error instanceof ApiError)) {
    return "generic"
  }
  const detail: string = error.detail ?? ""
  if (detail in DETAIL_KEYS) {
    return DETAIL_KEYS[detail] as ErrorKey
  }
  // A 422 joins the messages of all the fields; the password check is the one worth its own message
  if (detail.includes("This password is too common")) {
    return "commonPassword"
  }
  return STATUS_KEYS[error.status] ?? (error.status >= 500 ? "server" : "generic")
}

let installed = false

/** Registers the error interceptor of the generated client once per JS realm. */
export function installApiErrors(): void {
  if (installed) {
    return
  }
  installed = true
  client.interceptors.error.use(
    (error: unknown, response: Response | undefined): ApiError =>
      error instanceof ApiError ? error : new ApiError(response?.status ?? 0, error),
  )
}
