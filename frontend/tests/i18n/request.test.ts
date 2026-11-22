import { describe, expect, it } from "vitest"
import requestConfig from "@/i18n/request"
import en from "../../messages/en.json"
import ru from "../../messages/ru.json"

// getRequestConfig is mocked in setupTests to return the factory itself
const resolve = requestConfig as unknown as (params: {
  requestLocale: Promise<string | undefined>
}) => Promise<{ locale: string; messages: unknown }>

describe("request config", () => {
  it("loads the messages of the requested locale", async () => {
    expect(await resolve({ requestLocale: Promise.resolve("ru") })).toEqual({ locale: "ru", messages: ru })
  })

  it("falls back to the default locale", async () => {
    expect(await resolve({ requestLocale: Promise.resolve(undefined) })).toEqual({ locale: "en", messages: en })
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
