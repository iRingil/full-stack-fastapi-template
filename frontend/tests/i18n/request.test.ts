import { notFound } from "next/navigation"
import { locale } from "next/root-params"
import { describe, expect, it, vi } from "vitest"
import requestConfig from "@/i18n/request"
import en from "../../messages/en.json"
import ru from "../../messages/ru.json"

// The real module is replaced by the Next.js compiler and throws when imported as is
vi.mock("next/root-params", () => ({ locale: vi.fn() }))

// getRequestConfig is mocked in setupTests to return the factory itself
const resolve = requestConfig as unknown as (params: {
  locale?: string
}) => Promise<{ locale: string; messages: unknown }>

describe("request config", () => {
  it("loads the messages of the locale in the path", async () => {
    vi.mocked(locale).mockResolvedValueOnce("ru")
    expect(await resolve({})).toEqual({ locale: "ru", messages: ru })
  })

  it("prefers a locale passed explicitly", async () => {
    expect(await resolve({ locale: "en" })).toEqual({ locale: "en", messages: en })
    expect(locale).not.toHaveBeenCalled()
  })

  it("answers 404 for an unknown locale", async () => {
    vi.mocked(locale).mockResolvedValueOnce("unknown.txt")
    vi.mocked(notFound).mockImplementationOnce((): never => {
      throw new Error("404")
    })
    await expect(resolve({})).rejects.toThrow("404")
  })
})

describe("messages", () => {
  /**
   * Lists the keys of a messages file as "Namespace.key".
   * @param messages - The file.
   * @returns The sorted keys.
   */
  const keys = (messages: Record<string, Record<string, string>>): string[] =>
    Object.entries(messages)
      .flatMap(([namespace, entries]) => Object.keys(entries).map((key) => `${namespace}.${key}`))
      .sort()

  it("has the same keys in every locale", () => {
    expect(keys(ru)).toEqual(keys(en))
  })
})
