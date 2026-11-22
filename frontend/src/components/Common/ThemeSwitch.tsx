/**
 * @file A header button that toggles between the light and the dark theme.
 */

"use client"

import { Button, useIsHydrated } from "@heroui/react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import type { ReactNode } from "react"
import { FiMoon, FiSun } from "react-icons/fi"

/**
 * Renders the toggle; before hydration the theme is unknown, so the button is a placeholder until then.
 * @returns The button.
 */
export function ThemeSwitch(): ReactNode {
  const t = useTranslations("Common")
  const { resolvedTheme, setTheme } = useTheme()
  const isHydrated: boolean = useIsHydrated()
  const isDark: boolean = isHydrated && resolvedTheme === "dark"
  return (
    <Button
      isIconOnly
      variant="ghost"
      size="sm"
      aria-label={isDark ? t("lightTheme") : t("darkTheme")}
      isDisabled={!isHydrated}
      onPress={(): void => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <FiSun aria-hidden /> : <FiMoon aria-hidden />}
    </Button>
  )
}
