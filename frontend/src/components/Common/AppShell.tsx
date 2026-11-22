/**
 * @file Frame of the logged-in area: header, sidebar (a drawer on small screens) and the page.
 */

"use client"

import { Button, Drawer } from "@heroui/react"
import { useTranslations } from "next-intl"
import { type ReactNode, Suspense, useState } from "react"
import { FiMenu } from "react-icons/fi"
import { LocaleSwitch } from "./LocaleSwitch"
import { Logo } from "./Logo"
import { SidebarNav } from "./SidebarNav"
import { ThemeSwitch } from "./ThemeSwitch"
import { UserMenu } from "./UserMenu"

/**
 * Renders the frame around a page.
 * @param props - The page.
 * @returns The frame.
 */
export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const t = useTranslations("Nav")
  const [isMenuOpen, setMenuOpen] = useState<boolean>(false)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-separator bg-background/80 backdrop-blur">
        <div className="flex h-16 items-center gap-2 px-4">
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            className="md:hidden"
            aria-label={t("openMenu")}
            onPress={(): void => setMenuOpen(true)}
          >
            <FiMenu aria-hidden />
          </Button>
          <Logo />
          <div className="ms-auto flex items-center gap-1">
            <Suspense>
              <LocaleSwitch />
            </Suspense>
            <ThemeSwitch />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-e border-separator p-4 md:block">
          <SidebarNav />
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>

      <Drawer.Backdrop isOpen={isMenuOpen} onOpenChange={setMenuOpen}>
        <Drawer.Content placement="left">
          <Drawer.Dialog className="w-72">
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>{t("menu")}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <SidebarNav onNavigate={(): void => setMenuOpen(false)} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </div>
  )
}
