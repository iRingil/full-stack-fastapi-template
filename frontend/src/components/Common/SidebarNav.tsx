/**
 * @file Navigation of the logged-in area; the admin page is listed for superusers only.
 */

"use client"

import { cn } from "@heroui/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import type { IconType } from "react-icons"
import { FiBriefcase, FiHome, FiSettings, FiUsers } from "react-icons/fi"
import { useCurrentUser } from "@/hooks/useAuth"
import { Link, usePathname } from "@/i18n/navigation"
import { DASHBOARD_PATH, matchesPath } from "@/lib/paths"

type NavItem = { href: string; label: "dashboard" | "items" | "admin" | "settings"; icon: IconType; superuser?: true }

const NAV_ITEMS: readonly NavItem[] = [
  { href: DASHBOARD_PATH, label: "dashboard", icon: FiHome },
  { href: "/items", label: "items", icon: FiBriefcase },
  { href: "/admin", label: "admin", icon: FiUsers, superuser: true },
  { href: "/settings", label: "settings", icon: FiSettings },
]

/**
 * Renders the links; the current page is highlighted.
 * @param props - Called after a link is clicked (closes the mobile drawer).
 * @returns The navigation.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }): ReactNode {
  const t = useTranslations("Nav")
  const pathname: string = usePathname()
  const { data: user } = useCurrentUser()
  const items: NavItem[] = NAV_ITEMS.filter((item: NavItem): boolean => !item.superuser || Boolean(user?.is_superuser))

  return (
    <nav aria-label={t("main")}>
      <ul className="flex flex-col gap-1">
        {items.map((item: NavItem): ReactNode => {
          const isActive: boolean = matchesPath(pathname, [item.href])
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent-soft text-accent-soft-foreground"
                    : "text-muted hover:bg-default hover:text-foreground",
                )}
              >
                <item.icon aria-hidden className="size-4" />
                {t(item.label)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
