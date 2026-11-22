/**
 * @file Pagination for tables: "first … around the current … last" page links with previous/next.
 */

"use client"

import { Pagination } from "@heroui/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

/**
 * Lists the pages to show: the first, the last and two around the current one; gaps become an ellipsis.
 * @param page - The current page (1-based).
 * @param totalPages - The number of pages.
 * @returns The page numbers and "ellipsis" markers.
 */
export function visiblePages(page: number, totalPages: number): (number | "ellipsis")[] {
  const result: (number | "ellipsis")[] = []
  for (let current = 1; current <= totalPages; current++) {
    if (current === 1 || current === totalPages || Math.abs(current - page) <= 1) {
      result.push(current)
    } else if (result.at(-1) !== "ellipsis") {
      result.push("ellipsis")
    }
  }
  return result
}

export type TablePaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/**
 * Renders the pagination, nothing when everything fits on one page.
 * @param props - The current page, page size, total number of rows and the change handler.
 * @returns The pagination.
 */
export function TablePagination({ page, pageSize, total, onPageChange }: TablePaginationProps): ReactNode {
  const t = useTranslations("Common")
  const totalPages: number = Math.ceil(total / pageSize)
  if (totalPages <= 1) {
    return null
  }
  const first: number = (page - 1) * pageSize + 1
  const last: number = Math.min(page * pageSize, total)
  return (
    <Pagination size="sm" aria-label={t("pagination")}>
      <Pagination.Summary>{t("paginationSummary", { first, last, total })}</Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page <= 1} onPress={(): void => onPageChange(page - 1)}>
            <Pagination.PreviousIcon />
            <span>{t("previous")}</span>
          </Pagination.Previous>
        </Pagination.Item>
        {visiblePages(page, totalPages).map(
          (item: number | "ellipsis", index: number): ReactNode => (
            <Pagination.Item key={item === "ellipsis" ? `ellipsis-${index}` : item}>
              {item === "ellipsis" ? (
                <Pagination.Ellipsis />
              ) : (
                <Pagination.Link isActive={item === page} onPress={(): void => onPageChange(item)}>
                  {item}
                </Pagination.Link>
              )}
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next isDisabled={page >= totalPages} onPress={(): void => onPageChange(page + 1)}>
            <span>{t("next")}</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  )
}
