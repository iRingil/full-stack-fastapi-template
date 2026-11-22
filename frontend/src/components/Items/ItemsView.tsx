/**
 * @file The items page: the user's items in a paginated table, with "add", "edit" and "delete".
 */

"use client"

import { Button, cn, EmptyState, Skeleton, Table } from "@heroui/react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect, useState } from "react"
import { FiInbox, FiPlus } from "react-icons/fi"
import { readItemsOptions } from "@/client/@tanstack/react-query.gen"
import type { ItemPublic } from "@/client/types.gen"
import { FormAlert } from "@/components/ui/FormAlert"
import { TablePagination } from "@/components/ui/TablePagination"
import { useItemMutations } from "@/hooks/useItemMutations"
import { usePageParam } from "@/hooks/usePageParam"
import { errorMessage } from "@/lib/api-error"
import { ItemActionsMenu } from "./ItemActionsMenu"
import { ItemFormDialog } from "./ItemFormDialog"

export const ITEMS_PAGE_SIZE = 10

/**
 * Renders the page content.
 * @returns The heading, the "add" button and the table.
 */
export function ItemsView(): ReactNode {
  const t = useTranslations("Items")
  const tc = useTranslations("Common")
  const [page, setPage] = usePageParam()
  const [isAddOpen, setAddOpen] = useState<boolean>(false)
  const { create } = useItemMutations()
  const { data, error, isPending, isPlaceholderData } = useQuery({
    ...readItemsOptions({ query: { skip: (page - 1) * ITEMS_PAGE_SIZE, limit: ITEMS_PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  })

  // After deleting the last row of the last page, step back to the page that still has rows
  const lastPage: number = Math.max(1, Math.ceil((data?.count ?? 0) / ITEMS_PAGE_SIZE))
  useEffect((): void => {
    if (data && page > lastPage) {
      setPage(lastPage)
    }
  }, [data, page, lastPage, setPage])

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button onPress={(): void => setAddOpen(true)}>
          <FiPlus aria-hidden />
          {t("add")}
        </Button>
      </div>

      {error ? <FormAlert>{errorMessage(error, tc("errorGeneric"))}</FormAlert> : null}

      <Table>
        <Table.ScrollContainer>
          {/* While the next page loads, the previous one stays dimmed (on the table: React Aria caches the rows) */}
          <Table.Content
            aria-label={t("title")}
            className={cn("min-w-[560px] transition-opacity", isPlaceholderData && "opacity-50")}
          >
            <Table.Header>
              <Table.Column isRowHeader>{t("itemTitle")}</Table.Column>
              <Table.Column>{t("itemDescription")}</Table.Column>
              <Table.Column className="w-16 text-end">
                <span className="sr-only">{tc("actions")}</span>
              </Table.Column>
            </Table.Header>
            <Table.Body
              items={isPending ? [] : (data?.data ?? [])}
              renderEmptyState={(): ReactNode =>
                isPending ? (
                  <div className="flex flex-col gap-3 p-4">
                    <Skeleton className="h-4 w-3/5 rounded-lg" />
                    <Skeleton className="h-4 w-4/5 rounded-lg" />
                    <Skeleton className="h-4 w-2/5 rounded-lg" />
                  </div>
                ) : (
                  <EmptyState className="flex flex-col items-center gap-2 py-10 text-center">
                    <FiInbox aria-hidden className="size-6 text-muted" />
                    <span className="font-medium">{t("emptyTitle")}</span>
                    <span className="text-sm text-muted">{t("emptyDescription")}</span>
                  </EmptyState>
                )
              }
            >
              {(item: ItemPublic): ReactNode => (
                <Table.Row id={item.id}>
                  <Table.Cell className="max-w-xs truncate font-medium">{item.title}</Table.Cell>
                  <Table.Cell className="max-w-md truncate text-muted">{item.description || "—"}</Table.Cell>
                  <Table.Cell className="text-end">
                    <ItemActionsMenu item={item} />
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        <Table.Footer>
          <TablePagination page={page} pageSize={ITEMS_PAGE_SIZE} total={data?.count ?? 0} onPageChange={setPage} />
        </Table.Footer>
      </Table>

      <ItemFormDialog
        isOpen={isAddOpen}
        onClose={(): void => setAddOpen(false)}
        title={t("addTitle")}
        submitLabel={tc("create")}
        onSubmit={create}
      />
    </section>
  )
}
