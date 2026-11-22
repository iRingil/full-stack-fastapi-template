/**
 * @file A locale-aware link that looks like a HeroUI button (a real `<a>`, so it is crawlable and opens in a tab).
 */

import { buttonVariants, cn } from "@heroui/react"
import type { ComponentProps, ReactNode } from "react"
import { Link } from "@/i18n/navigation"

export type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "tertiary" | "outline" | "ghost"
  size?: "sm" | "md" | "lg"
  fullWidth?: boolean
}

/**
 * Renders the link.
 * @param props - The link props plus the button look.
 * @param props.variant - The button variant, "primary" by default.
 * @param props.size - The button size, "md" by default.
 * @param props.fullWidth - Whether the button takes the whole width.
 * @param props.className - Extra classes.
 * @returns The link.
 */
export function LinkButton({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  ...props
}: LinkButtonProps): ReactNode {
  return <Link className={cn(buttonVariants({ variant, size, fullWidth }), className)} {...props} />
}
