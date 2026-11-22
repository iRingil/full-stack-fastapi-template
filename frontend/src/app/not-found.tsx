/**
 * @file 404 for requests outside any locale (rare: `proxy.ts` adds a locale to every page path).
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
