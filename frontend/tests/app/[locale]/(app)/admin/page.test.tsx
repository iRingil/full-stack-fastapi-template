import { type ReactElement, Suspense } from "react"
import { describe, expect, it } from "vitest"
import UsersPage, { generateMetadata } from "@/app/[locale]/(app)/admin/page"
import { UsersView } from "@/components/Admin/UsersView"

describe("UsersPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata()
    expect(metadata.title).toBe("Users")
  })

  it("renders the UsersView", async () => {
    const element = (await UsersPage()) as ReactElement<{ children: ReactElement }>
    expect(element.type).toBe(Suspense)
    expect(element.props.children.type).toBe(UsersView)
  })
})
