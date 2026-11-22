import { setRequestLocale } from "next-intl/server"
import { type ReactElement, Suspense } from "react"
import { describe, expect, it } from "vitest"
import UsersPage, { generateMetadata } from "@/app/[locale]/(app)/admin/page"
import { UsersView } from "@/components/Admin/UsersView"

const params = { params: Promise.resolve({ locale: "ru" }) }

describe("UsersPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata(params)
    expect(metadata.title).toBe("Users")
  })

  it("renders the UsersView in the requested locale", async () => {
    const element = (await UsersPage(params)) as ReactElement<{ children: ReactElement }>
    expect(element.type).toBe(Suspense)
    expect(element.props.children.type).toBe(UsersView)
    expect(setRequestLocale).toHaveBeenCalledWith("ru")
  })
})
