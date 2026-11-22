import { type ReactElement, Suspense } from "react"
import { describe, expect, it } from "vitest"
import LoginPage, { generateMetadata } from "@/app/[locale]/(auth)/login/page"
import { LoginForm } from "@/components/Auth/LoginForm"

describe("LoginPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata()
    expect(metadata.title).toBe("Log in")
    expect(metadata.alternates?.canonical).toBe("/login")
  })

  it("renders the LoginForm", async () => {
    const element = (await LoginPage()) as ReactElement<{ children: ReactElement }>
    expect(element.type).toBe(Suspense)
    expect(element.props.children.type).toBe(LoginForm)
  })
})
