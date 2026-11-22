/**
 * @file Browser-side calls of the auth routes (`src/app/api/auth/*`), which set and clear the httpOnly cookie.
 */

import { ApiError } from "./api-error"

/** The login form: the backend's OAuth2 endpoint calls the email `username`. */
export type Credentials = { username: string; password: string }

/**
 * Reads an error body as JSON, or as text when it is not JSON.
 * @param response - The failed response.
 * @returns The parsed body.
 */
async function readBody(response: Response): Promise<unknown> {
  const text: string = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Logs in: on success the auth cookie is set.
 * @param credentials - The email and password.
 * @returns Nothing.
 * @throws {ApiError} With the backend's message, e.g. 400 "Incorrect email or password".
 */
export async function requestLogin(credentials: Credentials): Promise<void> {
  let response: Response
  try {
    response = await fetch("/api/auth/login", { method: "POST", body: new URLSearchParams(credentials) })
  } catch (error) {
    throw new ApiError(0, error)
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readBody(response))
  }
}

/** Logs out: the auth cookie is cleared. A network failure is ignored, the user leaves anyway. */
export async function requestLogout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" })
  } catch {
    // The next protected request answers 401 and repeats the logout
  }
}
