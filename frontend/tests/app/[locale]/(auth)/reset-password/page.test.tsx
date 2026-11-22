import { type ReactElement, Suspense } from "react"
import { describe, expect, it } from "vitest"
import ResetPasswordPage, { generateMetadata } from "@/app/[locale]/(auth)/reset-password/page"
import { ResetPasswordForm } from "@/components/Auth/ResetPasswordForm"

describe("ResetPasswordPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata()
    expect(metadata.title).toBe("Set a new password")
    expect(metadata.robots).toEqual({ index: false })
  })

  it("renders the ResetPasswordForm", async () => {
    const element = (await ResetPasswordPage()) as ReactElement<{ children: ReactElement }>
    expect(element.type).toBe(Suspense)
    expect(element.props.children.type).toBe(ResetPasswordForm)
  })
})
