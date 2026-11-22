import { setRequestLocale } from "next-intl/server"
import { type ReactElement, Suspense } from "react"
import { describe, expect, it } from "vitest"
import ItemsPage, { generateMetadata } from "@/app/[locale]/(app)/items/page"
import { ItemsView } from "@/components/Items/ItemsView"

const params = { params: Promise.resolve({ locale: "ru" }) }

describe("ItemsPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata(params)
    expect(metadata.title).toBe("Items")
  })

  it("renders the ItemsView in the requested locale", async () => {
    const element = (await ItemsPage(params)) as ReactElement<{ children: ReactElement }>
    expect(element.type).toBe(Suspense)
    expect(element.props.children.type).toBe(ItemsView)
    expect(setRequestLocale).toHaveBeenCalledWith("ru")
  })
})
