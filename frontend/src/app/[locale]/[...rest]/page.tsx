/**
 * @file Catch-all for unknown paths inside a locale: renders the localized 404 of `[locale]/not-found.tsx`.
 */

import { notFound } from "next/navigation"

export default function CatchAll(): never {
  notFound()
}
