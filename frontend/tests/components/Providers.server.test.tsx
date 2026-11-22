// @vitest-environment node
import { NextIntlClientProvider } from "next-intl"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Providers } from "@/components/Providers"
import messages from "../../messages/en.json"

describe("Providers on the server", () => {
  it("renders the theme script as an executable one", () => {
    const html = renderToString(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <Providers>page</Providers>
      </NextIntlClientProvider>,
    )
    expect(html).toContain('<script type="text/javascript"')
    expect(html).toContain("page")
  })
})
