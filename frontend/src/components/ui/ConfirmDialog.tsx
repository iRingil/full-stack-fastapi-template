/**
 * @file A controlled confirmation dialog for destructive actions (delete an item, a user, the account).
 */

import { AlertDialog, Button } from "@heroui/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

export type ConfirmDialogProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  isPending?: boolean
}

/**
 * Renders the dialog; the parent owns the open state and closes it after the action succeeds.
 * @param props - The state, texts and the action.
 * @returns The dialog.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
  isPending,
}: ConfirmDialogProps): ReactNode {
  const t = useTranslations("Common")
  // The dialog has no trigger inside, so it only ever reports closing (Escape, the backdrop, a close button)
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[420px]">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>{children}</AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary" isDisabled={isPending}>
              {t("cancel")}
            </Button>
            <Button variant="danger" isPending={isPending} onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
