/**
 * @file Layout of the auth pages (login, sign-up, password recovery, email confirmation): a centered card.
 */

import { setRequestLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { PublicHeader } from "@/components/Common/PublicHeader"
import { type LocaleParams, localeOf } from "@/lib/site"

export default async function AuthLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }): Promise<ReactNode> {
  // The header is translated on the server: without the locale set here the pages could not be static
  setRequestLocale(await localeOf(params))
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader showAuthLinks={false} />
      <main className="flex flex-1 items-start justify-center px-4 py-12 md:items-center">{children}</main>
    </div>
  )
}
