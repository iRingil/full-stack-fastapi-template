/**
 * @file The settings page: tabs for the profile, password, appearance and account deletion.
 * @description Superusers have no "Danger zone": the backend does not let them delete themselves.
 */

"use client"

import { Tabs } from "@heroui/react"
import { useTranslations } from "next-intl"
import type { ComponentType, ReactNode } from "react"
import { useCurrentUser } from "@/hooks/useAuth"
import { Appearance } from "./Appearance"
import { ChangePassword } from "./ChangePassword"
import { DeleteAccount } from "./DeleteAccount"
import { UserInformation } from "./UserInformation"

type Tab = { id: "profile" | "password" | "appearance" | "danger"; component: ComponentType }

const TABS: readonly Tab[] = [
  { id: "profile", component: UserInformation },
  { id: "password", component: ChangePassword },
  { id: "appearance", component: Appearance },
  { id: "danger", component: DeleteAccount },
]

/**
 * Renders the page content.
 * @returns The heading and the tabs.
 */
export function SettingsView(): ReactNode {
  const t = useTranslations("Settings")
  const { data: user } = useCurrentUser()
  const tabs: Tab[] = TABS.filter((tab: Tab): boolean => tab.id !== "danger" || user?.is_superuser === false)

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Tabs className="w-full">
        <Tabs.ListContainer>
          <Tabs.List aria-label={t("title")}>
            {tabs.map(
              (tab: Tab): ReactNode => (
                <Tabs.Tab key={tab.id} id={tab.id}>
                  {t(`tab_${tab.id}`)}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ),
            )}
          </Tabs.List>
        </Tabs.ListContainer>
        {tabs.map(
          (tab: Tab): ReactNode => (
            <Tabs.Panel key={tab.id} id={tab.id} className="pt-6">
              <tab.component />
            </Tabs.Panel>
          ),
        )}
      </Tabs>
    </section>
  )
}
