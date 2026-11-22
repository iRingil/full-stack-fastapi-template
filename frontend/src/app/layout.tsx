/**
 * @file The root layout only passes through: `<html>` is rendered by `[locale]/layout.tsx`, which knows the language.
 * It exists so that `app/not-found.tsx` has a parent.
 */

import type { ReactNode } from "react"

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return children
}
