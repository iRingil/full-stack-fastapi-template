/**
 * @file Layout of the logged-in area (access is checked by `proxy.ts`); these pages are not for search engines.
 */

import type { Metadata } from "next"
import type { ReactNode } from "react"
import { AppShell } from "@/components/Common/AppShell"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AppLayout({ children }: { children: ReactNode }): ReactNode {
  return <AppShell>{children}</AppShell>
}
