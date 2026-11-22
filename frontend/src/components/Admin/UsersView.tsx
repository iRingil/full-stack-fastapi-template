/**
 * @file The admin page: all users in a paginated table, with "add", "edit" and "delete". Superusers only.
 */

"use client"

import { Button, Chip, cn, EmptyState, Skeleton, Table } from "@heroui/react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect, useState } from "react"
import { FiPlus, FiUsers } from "react-icons/fi"
import { readUsersOptions } from "@/client/@tanstack/react-query.gen"
import type { UserPublic } from "@/client/types.gen"
import { FormAlert } from "@/components/ui/FormAlert"
import { TablePagination } from "@/components/ui/TablePagination"
import { useCurrentUser } from "@/hooks/useAuth"
import { useErrorMessage } from "@/hooks/useErrorMessage"
import { usePageParam } from "@/hooks/usePageParam"
import { useUserMutations } from "@/hooks/useUserMutations"
import { UserActionsMenu } from "./UserActionsMenu"
import { UserFormDialog } from "./UserFormDialog"

export const USERS_PAGE_SIZE = 10

/**
 * Renders the page content; a user without superuser rights sees a notice instead.
 * @returns The heading, the "add" button and the table.
 */
export function UsersView(): ReactNode {
  const t = useTranslations("Admin")
  const tc = useTranslations("Common")
  const { data: currentUser } = useCurrentUser()
  const isSuperuser: boolean = currentUser?.is_superuser === true
  const [page, setPage] = usePageParam()
  const [isAddOpen, setAddOpen] = useState<boolean>(false)
  const { create } = useUserMutations()
  const errorMessage = useErrorMessage()
  const { data, error, isPending, isPlaceholderData } = useQuery({
    ...readUsersOptions({ query: { skip: (page - 1) * USERS_PAGE_SIZE, limit: USERS_PAGE_SIZE } }),
    placeholderData: keepPreviousData,
    enabled: isSuperuser,
  })

  const lastPage: number = Math.max(1, Math.ceil((data?.count ?? 0) / USERS_PAGE_SIZE))
  useEffect((): void => {
    if (data && page > lastPage) {
      setPage(lastPage)
    }
  }, [data, page, lastPage, setPage])

  if (currentUser && !isSuperuser) {
    return (
      <section className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <FormAlert status="warning" title={t("forbiddenTitle")}>
          {t("forbiddenDescription")}
        </FormAlert>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button onPress={(): void => setAddOpen(true)} isDisabled={!isSuperuser}>
          <FiPlus aria-hidden />
          {t("add")}
        </Button>
      </div>

      {error ? <FormAlert>{errorMessage(error)}</FormAlert> : null}

      <Table>
        <Table.ScrollContainer>
          {/* While the next page loads, the previous one stays dimmed (on the table: React Aria caches the rows) */}
          <Table.Content
            aria-label={t("title")}
            className={cn("min-w-[720px] transition-opacity", isPlaceholderData && "opacity-50")}
          >
            <Table.Header>
              <Table.Column isRowHeader>{tc("fullName")}</Table.Column>
              <Table.Column>{tc("email")}</Table.Column>
              <Table.Column>{t("role")}</Table.Column>
              <Table.Column>{t("status")}</Table.Column>
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
                    <FiUsers aria-hidden className="size-6 text-muted" />
                    <span className="font-medium">{t("emptyTitle")}</span>
                  </EmptyState>
                )
              }
            >
              {(user: UserPublic): ReactNode => {
                const isCurrentUser: boolean = user.id === currentUser?.id
                return (
                  <Table.Row id={user.id}>
                    <Table.Cell className="max-w-xs">
                      <span className={user.full_name ? "font-medium" : "text-muted"}>{user.full_name || "—"}</span>
                      {isCurrentUser ? (
                        <Chip size="sm" color="accent" className="ms-2">
                          {t("you")}
                        </Chip>
                      ) : null}
                    </Table.Cell>
                    <Table.Cell className="max-w-xs truncate">{user.email}</Table.Cell>
                    <Table.Cell>{user.is_superuser ? t("superuser") : t("user")}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" color={user.is_active ? "success" : "default"}>
                        {user.is_active ? t("active") : t("inactive")}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-end">
                      <UserActionsMenu user={user} isCurrentUser={isCurrentUser} />
                    </Table.Cell>
                  </Table.Row>
                )
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        <Table.Footer>
          <TablePagination page={page} pageSize={USERS_PAGE_SIZE} total={data?.count ?? 0} onPageChange={setPage} />
        </Table.Footer>
      </Table>

      <UserFormDialog
        isOpen={isAddOpen}
        onClose={(): void => setAddOpen(false)}
        title={t("addTitle")}
        submitLabel={tc("create")}
        onSubmit={create}
      />
    </section>
  )
}
