import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"
import LocaleLayout, { generateMetadata, generateStaticParams, viewport } from "@/app/[locale]/layout"

vi.mock("next/font/google", () => ({ Onest: () => ({ variable: "font-onest" }) }))

const params = (locale: string) => ({ params: Promise.resolve({ locale }) })

describe("LocaleLayout", () => {
  it("pre-renders every locale", () => {
    expect(generateStaticParams()).toEqual([{ locale: "en" }, { locale: "ru" }])
  })

  it("describes the site", async () => {
    const metadata = await generateMetadata(params("ru"))
    expect(metadata.title).toEqual({ default: "Full Stack FastAPI", template: "%s | Full Stack FastAPI" })
    expect(metadata.openGraph).toMatchObject({ locale: "ru" })
    expect(viewport.themeColor).toHaveLength(2)
  })

  it("renders <html> in the requested language with the font variable", async () => {
    const html = (await LocaleLayout({ children: <p>page</p>, ...params("ru") })) as ReactElement<{
      lang: string
      className: string
    }>
    expect(html.type).toBe("html")
    expect(html.props.lang).toBe("ru")
    expect(html.props.className).toBe("font-onest")
    expect(setRequestLocale).toHaveBeenCalledWith("ru")
    expect(notFound).not.toHaveBeenCalled()
  })

  it("answers 404 for an unknown locale", async () => {
    await LocaleLayout({ children: null, ...params("xx") })
    expect(notFound).toHaveBeenCalled()
  })
})
