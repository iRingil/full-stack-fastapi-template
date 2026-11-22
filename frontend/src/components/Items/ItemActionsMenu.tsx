/**
 * @file The "…" menu of an item row: edit and delete.
 * @description Action-Dialog pattern: the menu items only open; the dialogs are rendered here, outside the menu,
 * and this component owns which one is open.
 */

"use client"

import { Button, Dropdown, Label } from "@heroui/react"
import { useTranslations } from "next-intl"
import { type Key, type ReactNode, useState } from "react"
import { FiEdit2, FiMoreHorizontal, FiTrash2 } from "react-icons/fi"
import type { ItemPublic } from "@/client/types.gen"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useItemMutations } from "@/hooks/useItemMutations"
import { ItemFormDialog } from "./ItemFormDialog"

type OpenDialog = "edit" | "delete" | null

/**
 * Renders the menu and its dialogs.
 * @param props - The item.
 * @returns The menu.
 */
export function ItemActionsMenu({ item }: { item: ItemPublic }): ReactNode {
  const t = useTranslations("Items")
  const tc = useTranslations("Common")
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null)
  const { update, remove, isRemoving } = useItemMutations()
  const close = (): void => setOpenDialog(null)

  return (
    <>
      <Dropdown>
        <Button isIconOnly variant="ghost" size="sm" aria-label={tc("actionsFor", { name: item.title })}>
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

      <ItemFormDialog
        isOpen={openDialog === "edit"}
        onClose={close}
        item={item}
        title={t("editTitle")}
        submitLabel={tc("save")}
        onSubmit={(values) => update(item.id, values)}
      />
      <ConfirmDialog
        isOpen={openDialog === "delete"}
        onClose={close}
        title={t("deleteTitle")}
        confirmLabel={tc("delete")}
        isPending={isRemoving}
        onConfirm={(): void => {
          remove(item.id).then(close, (): void => undefined)
        }}
      >
        {t("deleteConfirm", { title: item.title })}
      </ConfirmDialog>
    </>
  )
}
