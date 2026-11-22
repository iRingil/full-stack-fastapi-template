/**
 * @file A controlled modal with a form: heading, fields, cancel and submit buttons.
 */

"use client"

import { Button, Modal } from "@heroui/react"
import { useTranslations } from "next-intl"
import type { FormEventHandler, ReactNode } from "react"
import { SurfaceFields } from "./FieldVariant"

export type FormDialogProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  submitLabel: string
  onSubmit: FormEventHandler<HTMLFormElement>
  isPending?: boolean
  children: ReactNode
}

/**
 * Renders the dialog; the parent owns the open state and closes it after the action succeeds.
 * @param props - The state, texts, the form's submit handler (react-hook-form's `handleSubmit(...)`) and fields.
 * @returns The dialog.
 */
export function FormDialog({
  isOpen,
  onClose,
  title,
  submitLabel,
  onSubmit,
  isPending,
  children,
}: FormDialogProps): ReactNode {
  const t = useTranslations("Common")
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open: boolean): void => (open ? undefined : onClose())}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[480px]">
          <form noValidate onSubmit={onSubmit}>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <SurfaceFields>{children}</SurfaceFields>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="tertiary" isDisabled={isPending}>
                {t("cancel")}
              </Button>
              <Button type="submit" isPending={isPending}>
                {submitLabel}
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
