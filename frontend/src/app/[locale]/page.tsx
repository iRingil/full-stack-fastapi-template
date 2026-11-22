/**
 * @file The public home page (statically rendered for each locale, indexed by search engines).
 */

import { Card } from "@heroui/react"
import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { ReactNode } from "react"
import type { IconType } from "react-icons"
import { FiGlobe, FiLock, FiServer } from "react-icons/fi"
import { PublicHeader } from "@/components/Common/PublicHeader"
import { LinkButton } from "@/components/ui/LinkButton"
import type { Locale } from "@/i18n/routing"
import { DASHBOARD_PATH } from "@/lib/paths"
import { type LocaleParams, localeAlternates, localeOf } from "@/lib/site"

const FEATURES: readonly { key: "backend" | "frontend" | "auth"; icon: IconType }[] = [
  { key: "backend", icon: FiServer },
  { key: "frontend", icon: FiGlobe },
  { key: "auth", icon: FiLock },
]

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale: Locale = await localeOf(params)
  const t = await getTranslations({ locale, namespace: "Home" })
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: localeAlternates("/", locale),
  }
}

export default async function HomePage({ params }: LocaleParams): Promise<ReactNode> {
  const locale: Locale = await localeOf(params)
  setRequestLocale(locale)
  const t = await getTranslations("Home")

  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 md:py-24">
        <section className="flex flex-col items-center gap-6 text-center">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-5xl">{t("heroTitle")}</h1>
          <p className="max-w-2xl text-lg text-pretty text-muted">{t("heroDescription")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton href={DASHBOARD_PATH} size="lg">
              {t("getStarted")}
            </LinkButton>
            <LinkButton href="/signup" size="lg" variant="secondary">
              {t("createAccount")}
            </LinkButton>
          </div>
        </section>
        <section aria-labelledby="features" className="flex flex-col gap-6">
          <h2 id="features" className="sr-only">
            {t("featuresTitle")}
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {FEATURES.map(
              ({ key, icon: Icon }): ReactNode => (
                <li key={key}>
                  <Card className="h-full">
                    <Card.Header>
                      <Icon aria-hidden className="mb-2 size-6 text-accent" />
                      <Card.Title>{t(`feature_${key}_title`)}</Card.Title>
                      <Card.Description>{t(`feature_${key}_text`)}</Card.Description>
                    </Card.Header>
                  </Card>
                </li>
              ),
            )}
          </ul>
        </section>
      </main>
    </>
  )
}
