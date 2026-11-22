/**
 * @file Settings tab "Appearance": light, dark or the system theme.
 */

import { Label, Radio, RadioGroup, useIsHydrated } from "@heroui/react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import type { ReactNode } from "react"

const THEMES = ["system", "light", "dark"] as const

/**
 * Renders the theme choice (disabled until hydration, when the stored theme becomes known).
 * @returns The radio group.
 */
export function Appearance(): ReactNode {
  const t = useTranslations("Settings")
  const { theme, setTheme } = useTheme()
  const isHydrated: boolean = useIsHydrated()
  return (
    <RadioGroup
      name="theme"
      value={isHydrated ? (theme ?? "system") : null}
      onChange={setTheme}
      isDisabled={!isHydrated}
    >
      <Label>{t("theme")}</Label>
      {THEMES.map(
        (value: (typeof THEMES)[number]): ReactNode => (
          <Radio key={value} value={value}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              {t(`theme_${value}`)}
            </Radio.Content>
          </Radio>
        ),
      )}
    </RadioGroup>
  )
}
