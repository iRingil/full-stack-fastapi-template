/**
 * @file A controlled modal with a form: heading, fields, cancel and submit buttons.
 */

"use client"

import { Button, Modal } from "@heroui/react"
import { useTranslations } from "next-intl"
import type { ReactNode, SubmitEventHandler } from "react"
import { SurfaceFields } from "./FieldVariant"

export type FormDialogProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  submitLabel: string
  onSubmit: SubmitEventHandler<HTMLFormElement>
  isPending?: boolean
  children: ReactNode
}

/**
 * Renders the dialog; the parent owns the open state and closes it after the action succeeds.
 * @description The close button comes last in the markup (it stays in the corner): Tab goes to the fields first.
 * Give the first field `autoFocus`, so that typing can start as soon as the dialog opens.
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
  // The dialog has no trigger inside, so it only ever reports closing (Escape, the backdrop, a close button)
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[480px]">
          <form noValidate onSubmit={onSubmit}>
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
            <Modal.CloseTrigger aria-label={t("close")} />
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
