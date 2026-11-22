/**
 * @file The site logo, linking to the home page.
 */

import Image from "next/image"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { Link } from "@/i18n/navigation"

/**
 * Renders the logo.
 * @param props - Where the logo leads (the home page by default).
 * @returns The logo link.
 */
export function Logo({ href = "/" }: { href?: string }): ReactNode {
  const t = useTranslations("Metadata")
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label={t("siteName")}>
      {/* The logo's teal is dim on the dark background, so it is lightened there */}
      <Image
        src="/assets/images/fastapi-logo.svg"
        alt=""
        width={140}
        height={26}
        priority
        unoptimized
        className="dark:brightness-125"
      />
    </Link>
  )
}
