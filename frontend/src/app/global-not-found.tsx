/**
 * @file 404 outside the localized layout: an unknown locale, or a path no route matches (rare: `proxy.ts` adds a
 * locale to every page path). It bypasses the layouts, so it is a whole document with its own styles.
 */

import type { ReactNode } from "react"
import "@/styles/globals.css"

export default function GlobalNotFound(): ReactNode {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <main className="text-center">
          <h1 className="text-6xl font-bold">404</h1>
          <p className="mt-2 text-muted">Page not found</p>
          <a className="link mt-4 inline-block" href="/">
            Go home
          </a>
        </main>
      </body>
    </html>
  )
}
