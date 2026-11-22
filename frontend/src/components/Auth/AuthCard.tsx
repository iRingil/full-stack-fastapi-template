/**
 * @file The card that holds every auth form (login, sign-up, password recovery, ...).
 */

import { Card } from "@heroui/react"
import type { ReactNode } from "react"
import { SurfaceFields } from "@/components/ui/FieldVariant"

export type AuthCardProps = {
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
}

/**
 * Renders the card.
 * @param props - The heading, the optional subtitle, the content and the footer (links to other auth pages).
 * @returns The card.
 */
export function AuthCard({ title, description, children, footer }: AuthCardProps): ReactNode {
  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <Card.Header>
        {/* The page heading, so an <h1> rather than Card.Title's <h3> */}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <Card.Description>{description}</Card.Description> : null}
      </Card.Header>
      {children ? (
        <Card.Content>
          <SurfaceFields>{children}</SurfaceFields>
        </Card.Content>
      ) : null}
      {footer ? <Card.Footer className="justify-center text-sm text-muted">{footer}</Card.Footer> : null}
    </Card>
  )
}
