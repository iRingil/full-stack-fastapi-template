/**
 * @file The current table page, kept in the `?page=` query parameter (shareable, survives reload).
 */

"use client"

import { useSearchParams } from "next/navigation"
import { usePathname, useRouter } from "@/i18n/navigation"

/**
 * Reads a page number from the query parameter.
 * @param value - The raw value.
 * @returns A positive integer, 1 for a missing or invalid value.
 */
export function parsePage(value: string | null): number {
  const page: number = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

/**
 * The page parameter and its setter (the setter replaces the history entry, so Back leaves the table).
 * @returns `[page, setPage]`.
 */
export function usePageParam(): [number, (page: number) => void] {
  const searchParams = useSearchParams()
  const pathname: string = usePathname()
  const router = useRouter()

  const setPage = (page: number): void => {
    const params: URLSearchParams = new URLSearchParams(searchParams.toString())
    if (page > 1) {
      params.set("page", String(page))
    } else {
      params.delete("page")
    }
    const query: string = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return [parsePage(searchParams.get("page")), setPage]
}
