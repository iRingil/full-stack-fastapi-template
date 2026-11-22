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

/**
 * Picks the message to show for a failed request.
 * @param error - Anything thrown by a query or mutation.
 * @param fallback - The (translated) message for errors without a backend `detail`.
 * @returns The backend's `detail`, or the fallback.
 */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.detail ? error.detail : fallback
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
