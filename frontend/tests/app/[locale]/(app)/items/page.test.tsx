import { type ReactElement, Suspense } from "react"
import { describe, expect, it } from "vitest"
import ItemsPage, { generateMetadata } from "@/app/[locale]/(app)/items/page"
import { ItemsView } from "@/components/Items/ItemsView"

describe("ItemsPage", () => {
  it("has its title", async () => {
    const metadata = await generateMetadata()
    expect(metadata.title).toBe("Items")
  })

  it("renders the ItemsView", async () => {
    const element = (await ItemsPage()) as ReactElement<{ children: ReactElement }>
    expect(element.type).toBe(Suspense)
    expect(element.props.children.type).toBe(ItemsView)
  })
})
