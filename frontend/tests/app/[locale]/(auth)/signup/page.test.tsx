import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import SignUpPage, { generateMetadata } from "@/app/[locale]/(auth)/signup/page"
import { SignUpForm } from "@/components/Auth/SignUpForm"

describe("SignUpPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata()
    expect(metadata.title).toBe("Sign up")
    expect(metadata.alternates?.canonical).toBe("/signup")
  })

  it("renders the SignUpForm", async () => {
    const element = (await SignUpPage()) as ReactElement
    expect(element.type).toBe(SignUpForm)
  })
})
