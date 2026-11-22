/**
 * @file A header menu that switches the site language, staying on the same page.
 */

"use client"

import { Button, Dropdown, Label } from "@heroui/react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import type { Key, ReactNode } from "react"
import { FiGlobe } from "react-icons/fi"
import { usePathname, useRouter } from "@/i18n/navigation"
import { type Locale, routing } from "@/i18n/routing"

/** Each language is named in itself, so a visitor finds theirs whatever the current language is. */
const LANGUAGE_NAMES: Record<string, string> = { en: "English", ru: "Русский" }

/**
 * Renders the menu.
 * @returns The menu.
 */
export function LocaleSwitch(): ReactNode {
  const t = useTranslations("Common")
  const locale: Locale = useLocale()
  const pathname: string = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const switchTo = (key: Key): void => {
    const query: string = searchParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { locale: key as Locale })
  }

  return (
    <Dropdown>
      <Button variant="ghost" size="sm" aria-label={t("language")}>
        <FiGlobe aria-hidden />
        <span className="uppercase">{locale}</span>
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label={t("language")} selectionMode="single" selectedKeys={[locale]} onAction={switchTo}>
          {routing.locales.map(
            (code: Locale): ReactNode => (
              <Dropdown.Item key={code} id={code} textValue={LANGUAGE_NAMES[code] ?? code}>
                <Label lang={code}>{LANGUAGE_NAMES[code] ?? code}</Label>
              </Dropdown.Item>
            ),
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
