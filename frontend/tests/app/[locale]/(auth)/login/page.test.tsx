import { setRequestLocale } from "next-intl/server"
import { type ReactElement, Suspense } from "react"
import { describe, expect, it } from "vitest"
import LoginPage, { generateMetadata } from "@/app/[locale]/(auth)/login/page"
import { LoginForm } from "@/components/Auth/LoginForm"

const params = { params: Promise.resolve({ locale: "ru" }) }

describe("LoginPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata(params)
    expect(metadata.title).toBe("Log in")
    expect(metadata.alternates?.canonical).toBe("/login")
  })

  it("renders the LoginForm in the requested locale", async () => {
    const element = (await LoginPage(params)) as ReactElement<{ children: ReactElement }>
    expect(element.type).toBe(Suspense)
    expect(element.props.children.type).toBe(LoginForm)
    expect(setRequestLocale).toHaveBeenCalledWith("ru")
  })
})
