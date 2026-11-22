/**
 * @file Layout of the auth pages (login, sign-up, password recovery, email confirmation): a centered card.
 */

import type { ReactNode } from "react"
import { PublicHeader } from "@/components/Common/PublicHeader"

export default function AuthLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader showAuthLinks={false} />
      <main className="flex flex-1 items-start justify-center px-4 py-12 md:items-center">{children}</main>
    </div>
  )
}
