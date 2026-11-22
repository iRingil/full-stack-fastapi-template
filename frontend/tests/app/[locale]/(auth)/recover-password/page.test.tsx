import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import RecoverPasswordPage, { generateMetadata } from "@/app/[locale]/(auth)/recover-password/page"
import { RecoverPasswordForm } from "@/components/Auth/RecoverPasswordForm"

describe("RecoverPasswordPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata()
    expect(metadata.title).toBe("Password recovery")
    expect(metadata.alternates?.canonical).toBe("/recover-password")
  })

  it("renders the RecoverPasswordForm", async () => {
    const element = (await RecoverPasswordPage()) as ReactElement
    expect(element.type).toBe(RecoverPasswordForm)
  })
})
