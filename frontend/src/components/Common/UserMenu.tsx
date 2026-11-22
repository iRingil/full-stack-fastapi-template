/**
 * @file The user's menu in the header: who is logged in, a link to the settings and logout.
 */

"use client"

import { Avatar, Button, Dropdown, Label } from "@heroui/react"
import { useTranslations } from "next-intl"
import type { Key, ReactNode } from "react"
import { FiLogOut, FiUser } from "react-icons/fi"
import { useAuth, useCurrentUser } from "@/hooks/useAuth"
import { useRouter } from "@/i18n/navigation"

/**
 * Builds the avatar initials from the name, or from the email when there is no name.
 * @param name - The full name, if any.
 * @param email - The email.
 * @returns One or two capital letters.
 */
export function initials(name: string | null | undefined, email: string): string {
  const words: string[] = (name ?? "").trim().split(/\s+/).filter(Boolean)
  const letters: string =
    words.length > 0 ? words.map((word: string): string => word.charAt(0)).join("") : email.charAt(0)
  return letters.slice(0, 2).toUpperCase()
}

/**
 * Renders the menu (nothing until the user is loaded).
 * @returns The menu.
 */
export function UserMenu(): ReactNode {
  const t = useTranslations("Nav")
  const { data: user } = useCurrentUser()
  const { logout } = useAuth()
  const router = useRouter()
  if (!user) {
    return null
  }

  const onAction = (key: Key): void => {
    if (key === "settings") {
      router.push("/settings")
    } else if (key === "logout") {
      void logout()
    }
  }

  return (
    <Dropdown>
      <Button variant="ghost" size="sm" aria-label={t("userMenu")} className="gap-2 ps-1">
        <Avatar size="sm">
          <Avatar.Fallback>{initials(user.full_name, user.email)}</Avatar.Fallback>
        </Avatar>
        <span className="hidden max-w-40 truncate sm:inline">{user.full_name || user.email}</span>
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={t("userMenu")} onAction={onAction}>
          <Dropdown.Item id="settings" textValue={t("profile")}>
            <FiUser aria-hidden />
            <Label>{t("profile")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="logout" textValue={t("logout")} variant="danger">
            <FiLogOut aria-hidden />
            <Label>{t("logout")}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
