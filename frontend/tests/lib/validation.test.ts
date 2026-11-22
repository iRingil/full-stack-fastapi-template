import { describe, expect, it } from "vitest"
import {
  changePasswordSchema,
  emailSchema,
  emptyToNull,
  itemSchema,
  loginSchema,
  profileSchema,
  resetPasswordSchema,
  signUpSchema,
  userSchema,
  type ValidationT,
} from "@/lib/validation"

const t: ValidationT = (key) => key

/**
 * Collects the error messages of a parse, by field.
 * @param result - The safeParse result.
 * @returns `{field: message}`.
 */
function errorsOf(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]))
}

describe("email fields", () => {
  it("trims and accepts a valid address", () => {
    expect(emailSchema(t).parse({ email: "  a@example.com " })).toEqual({ email: "a@example.com" })
  })

  it("reports empty, invalid and too long addresses", () => {
    expect(errorsOf(emailSchema(t).safeParse({ email: "" }))).toEqual({ email: "required" })
    expect(errorsOf(emailSchema(t).safeParse({ email: "nope" }))).toEqual({ email: "email" })
    expect(errorsOf(emailSchema(t).safeParse({ email: `${"a".repeat(250)}@example.com` }))).toEqual({
      email: "tooLong",
    })
  })
})

describe("password confirmation", () => {
  it("passes matching passwords", () => {
    const values = { fullName: "", email: "a@example.com", password: "12345678", confirmPassword: "12345678" }
    expect(signUpSchema(t).safeParse(values).success).toBe(true)
  })

  it("reports the mismatch on the confirmation field", () => {
    const values = { newPassword: "12345678", confirmPassword: "87654321" }
    expect(errorsOf(resetPasswordSchema(t).safeParse(values))).toEqual({ confirmPassword: "passwordsMismatch" })
  })

  it("checks the password length like the backend (8 to 72)", () => {
    const short = { currentPassword: "x", newPassword: "1234567", confirmPassword: "1234567" }
    const long = { currentPassword: "x", newPassword: "a".repeat(73), confirmPassword: "a".repeat(73) }
    const longest = { currentPassword: "x", newPassword: "a".repeat(72), confirmPassword: "a".repeat(72) }
    expect(errorsOf(changePasswordSchema(t).safeParse(short))).toEqual({ newPassword: "passwordLength" })
    expect(errorsOf(changePasswordSchema(t).safeParse(long))).toMatchObject({ newPassword: "passwordTooLong" })
    expect(changePasswordSchema(t).safeParse(longest).success).toBe(true)
  })

  it("counts the bytes of the password: bcrypt takes 72 of them", () => {
    const cyrillic = "й".repeat(37)
    const values = { currentPassword: "x", newPassword: cyrillic, confirmPassword: cyrillic }
    expect(errorsOf(changePasswordSchema(t).safeParse(values))).toEqual({ newPassword: "passwordTooLong" })
  })
})

describe("other schemas", () => {
  it("requires the login password", () => {
    expect(errorsOf(loginSchema(t).safeParse({ username: "a@example.com", password: "" }))).toEqual({
      password: "required",
    })
  })

  it("limits the profile name", () => {
    const values = { fullName: "a".repeat(256), email: "a@example.com", currentPassword: "" }
    expect(errorsOf(profileSchema(t, "a@example.com").safeParse(values))).toEqual({ fullName: "tooLong" })
  })

  it("requires the current password for another email only", () => {
    const schema = profileSchema(t, "a@example.com")
    const changed = { fullName: "", email: "b@example.com", currentPassword: "" }
    expect(errorsOf(schema.safeParse(changed))).toEqual({ currentPassword: "required" })
    expect(schema.safeParse({ ...changed, currentPassword: "secret" }).success).toBe(true)
    expect(schema.safeParse({ ...changed, email: " A@Example.com " }).success).toBe(true)
  })

  it("requires an item title", () => {
    expect(errorsOf(itemSchema(t).safeParse({ title: "  ", description: "" }))).toEqual({ title: "required" })
  })
})

describe("userSchema", () => {
  const base = { email: "a@example.com", fullName: "", isSuperuser: false, isActive: true }

  it("requires a password for a new user", () => {
    expect(errorsOf(userSchema(t, true).safeParse({ ...base, password: "", confirmPassword: "" }))).toEqual({
      password: "passwordLength",
    })
  })

  it("lets an edit keep the password", () => {
    expect(userSchema(t, false).safeParse({ ...base, password: "", confirmPassword: "" }).success).toBe(true)
    expect(userSchema(t, false).safeParse({ ...base, password: "short", confirmPassword: "short" }).success).toBe(false)
  })
})

describe("emptyToNull", () => {
  it("turns only the empty string into null", () => {
    expect(emptyToNull("")).toBeNull()
    expect(emptyToNull("x")).toBe("x")
  })
})
