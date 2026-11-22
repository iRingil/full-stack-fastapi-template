/**
 * @file The "…" menu of a user row: edit and delete (Action-Dialog pattern, see `Items/ItemActionsMenu.tsx`).
 */

"use client"

import { Button, Dropdown, Label } from "@heroui/react"
import { useTranslations } from "next-intl"
import { type Key, type ReactNode, useState } from "react"
import { FiEdit2, FiMoreHorizontal, FiTrash2 } from "react-icons/fi"
import type { UserPublic } from "@/client/types.gen"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useUserMutations } from "@/hooks/useUserMutations"
import { UserFormDialog } from "./UserFormDialog"

type OpenDialog = "edit" | "delete" | null

/**
 * Renders the menu and its dialogs.
 * @param props - The user and whether they are the admin themself (then the menu is disabled: the backend
 * forbids deleting oneself, and one's own data is edited in the settings).
 * @returns The menu.
 */
export function UserActionsMenu({ user, isCurrentUser }: { user: UserPublic; isCurrentUser: boolean }): ReactNode {
  const t = useTranslations("Admin")
  const tc = useTranslations("Common")
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null)
  const { update, remove, isRemoving } = useUserMutations()
  const close = (): void => setOpenDialog(null)

  return (
    <>
      <Dropdown>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          isDisabled={isCurrentUser}
          aria-label={tc("actionsFor", { name: user.email })}
        >
          <FiMoreHorizontal aria-hidden />
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label={tc("actions")} onAction={(key: Key): void => setOpenDialog(key as OpenDialog)}>
            <Dropdown.Item id="edit" textValue={tc("edit")}>
              <FiEdit2 aria-hidden />
              <Label>{tc("edit")}</Label>
            </Dropdown.Item>
            <Dropdown.Item id="delete" textValue={tc("delete")} variant="danger">
              <FiTrash2 aria-hidden />
              <Label>{tc("delete")}</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <UserFormDialog
        isOpen={openDialog === "edit"}
        onClose={close}
        user={user}
        title={t("editTitle")}
        submitLabel={tc("save")}
        onSubmit={(values) => update(user.id, values)}
      />
      <ConfirmDialog
        isOpen={openDialog === "delete"}
        onClose={close}
        title={t("deleteTitle")}
        confirmLabel={tc("delete")}
        isPending={isRemoving}
        onConfirm={(): void => {
          remove(user.id).then(close, (): void => undefined)
        }}
      >
        {t("deleteConfirm", { email: user.email })}
      </ConfirmDialog>
    </>
  )
}
