/**
 * @file The public home page (statically rendered for each locale, indexed by search engines).
 * @description A placeholder for the site's own landing page: what the template gives and how to start it.
 */

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

/** The real commands that start the template locally, in order. */
const QUICK_START: readonly { key: "backend" | "frontend" | "open"; command: string }[] = [
  { key: "backend", command: "cd backend/src && uvicorn app.main:app --reload" },
  { key: "frontend", command: "cd frontend && npm run dev" },
  { key: "open", command: "http://localhost:5173" },
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
  setRequestLocale(await localeOf(params))
  const t = await getTranslations("Home")

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4">
        <section className="grid items-center gap-12 py-16 md:grid-cols-[1.15fr_1fr] md:py-24">
          <div>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance md:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-pretty text-muted">{t("heroDescription")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href={DASHBOARD_PATH} size="lg">
                {t("openDashboard")}
              </LinkButton>
              <LinkButton href="/signup" size="lg" variant="outline">
                {t("createAccount")}
              </LinkButton>
            </div>
          </div>

          <figure className="rounded-3xl border border-separator bg-surface p-6 shadow-surface">
            <figcaption className="font-semibold">{t("quickStartTitle")}</figcaption>
            <ol className="mt-5 flex flex-col gap-5">
              {QUICK_START.map(
                ({ key, command }, index: number): ReactNode => (
                  <li key={key} className="grid grid-cols-[2rem_1fr] gap-x-3">
                    <span
                      aria-hidden
                      className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-soft-foreground"
                    >
                      {index + 1}
                    </span>
                    <span className="self-center text-sm font-medium">{t(`step_${key}`)}</span>
                    <code className="col-start-2 mt-2 block overflow-x-auto rounded-xl bg-surface-secondary px-3 py-2 font-mono text-sm whitespace-nowrap">
                      {command}
                    </code>
                  </li>
                ),
              )}
            </ol>
          </figure>
        </section>

        <section aria-labelledby="features" className="border-t border-separator py-12 md:py-16">
          <h2 id="features" className="sr-only">
            {t("featuresTitle")}
          </h2>
          <ul className="grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-separator">
            {FEATURES.map(
              ({ key, icon: Icon }): ReactNode => (
                <li key={key} className="md:px-8 md:first:ps-0 md:last:pe-0">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{t(`feature_${key}_title`)}</h3>
                  <p className="mt-2 text-pretty text-muted">{t(`feature_${key}_text`)}</p>
                </li>
              ),
            )}
          </ul>
        </section>
      </main>
    </>
  )
}
