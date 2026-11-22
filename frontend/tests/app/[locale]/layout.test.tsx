import { getLocale } from "next-intl/server"
import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"
import LocaleLayout, { generateMetadata, generateStaticParams, viewport } from "@/app/[locale]/layout"

// noinspection JSUnusedGlobalSymbols - the mocked module export
vi.mock("next/font/google", () => ({ Onest: () => ({ variable: "font-onest" }) }))

describe("LocaleLayout", () => {
  it("pre-renders every locale", () => {
    expect(generateStaticParams()).toEqual([{ locale: "en" }, { locale: "ru" }])
  })

  it("describes the site", async () => {
    vi.mocked(getLocale).mockResolvedValueOnce("ru")
    const metadata = await generateMetadata()
    expect(metadata.title).toEqual({ default: "Full Stack FastAPI", template: "%s | Full Stack FastAPI" })
    expect(metadata.openGraph).toMatchObject({ locale: "ru" })
    expect(viewport.themeColor).toHaveLength(2)
  })

  it("renders <html> in the request's language with the font variable", async () => {
    vi.mocked(getLocale).mockResolvedValueOnce("ru")
    const html = (await LocaleLayout({ children: <p>page</p> })) as ReactElement<{ lang: string; className: string }>
    expect(html.type).toBe("html")
    expect(html.props.lang).toBe("ru")
    expect(html.props.className).toBe("font-onest")
  })
})
