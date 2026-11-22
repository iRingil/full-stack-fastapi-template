/**
 * @file Settings tab "Danger zone": deletes the account and everything it owns, then logs out.
 */

"use client"

import { Button } from "@heroui/react"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { deleteUserMeMutation } from "@/client/@tanstack/react-query.gen"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useAuth } from "@/hooks/useAuth"
import { useNotify } from "@/hooks/useNotify"

/**
 * Renders the warning, the button and the confirmation dialog.
 * @returns The tab content.
 */
export function DeleteAccount(): ReactNode {
  const t = useTranslations("Settings")
  const notify = useNotify()
  const { logout } = useAuth()
  const [isConfirmOpen, setConfirmOpen] = useState<boolean>(false)
  const deleteMe = useMutation({
    ...deleteUserMeMutation(),
    onSuccess: async (): Promise<void> => {
      notify.success(t("accountDeleted"))
      await logout()
    },
    onError: notify.error,
  })

  return (
    <div className="flex max-w-md flex-col items-start gap-4">
      <p className="text-muted">{t("deleteAccountDescription")}</p>
      <Button variant="danger" onPress={(): void => setConfirmOpen(true)}>
        {t("deleteAccount")}
      </Button>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={(): void => setConfirmOpen(false)}
        title={t("deleteAccountTitle")}
        confirmLabel={t("deleteAccount")}
        isPending={deleteMe.isPending}
        onConfirm={(): void => deleteMe.mutate({})}
      >
        {t("deleteAccountConfirm")}
      </ConfirmDialog>
    </div>
  )
}
