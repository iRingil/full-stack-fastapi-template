import { setRequestLocale } from "next-intl/server"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import SignUpPage, { generateMetadata } from "@/app/[locale]/(auth)/signup/page"
import { SignUpForm } from "@/components/Auth/SignUpForm"

const params = { params: Promise.resolve({ locale: "ru" }) }

describe("SignUpPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata(params)
    expect(metadata.title).toBe("Sign up")
    expect(metadata.alternates?.canonical).toBe("/signup")
  })

  it("renders the SignUpForm in the requested locale", async () => {
    const element = (await SignUpPage(params)) as ReactElement
    expect(element.type).toBe(SignUpForm)
    expect(setRequestLocale).toHaveBeenCalledWith("ru")
  })
})
