import { setRequestLocale } from "next-intl/server"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import RecoverPasswordPage, { generateMetadata } from "@/app/[locale]/(auth)/recover-password/page"
import { RecoverPasswordForm } from "@/components/Auth/RecoverPasswordForm"

const params = { params: Promise.resolve({ locale: "ru" }) }

describe("RecoverPasswordPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata(params)
    expect(metadata.title).toBe("Password recovery")
    expect(metadata.alternates?.canonical).toBe("/recover-password")
  })

  it("renders the RecoverPasswordForm in the requested locale", async () => {
    const element = (await RecoverPasswordPage(params)) as ReactElement
    expect(element.type).toBe(RecoverPasswordForm)
    expect(setRequestLocale).toHaveBeenCalledWith("ru")
  })
})
