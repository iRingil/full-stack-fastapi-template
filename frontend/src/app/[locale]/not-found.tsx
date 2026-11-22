/**
 * @file Localized 404, also shown for unknown paths (see `[...rest]/page.tsx`).
 */

import type { ReactNode } from "react"
import { NotFound } from "@/components/Common/NotFound"

export default function LocaleNotFound(): ReactNode {
  return <NotFound />
}
