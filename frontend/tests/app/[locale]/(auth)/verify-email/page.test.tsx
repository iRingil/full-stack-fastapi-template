import { setRequestLocale } from "next-intl/server"
import { type ReactElement, Suspense } from "react"
import { describe, expect, it } from "vitest"
import VerifyEmailPage, { generateMetadata } from "@/app/[locale]/(auth)/verify-email/page"
import { VerifyEmail } from "@/components/Auth/VerifyEmail"

const params = { params: Promise.resolve({ locale: "ru" }) }

describe("VerifyEmailPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata(params)
    expect(metadata.title).toBe("Email confirmation")
    expect(metadata.robots).toEqual({ index: false })
  })

  it("renders the VerifyEmail in the requested locale", async () => {
    const element = (await VerifyEmailPage(params)) as ReactElement<{ children: ReactElement }>
    expect(element.type).toBe(Suspense)
    expect(element.props.children.type).toBe(VerifyEmail)
    expect(setRequestLocale).toHaveBeenCalledWith("ru")
  })
})
