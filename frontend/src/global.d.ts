/**
 * @file Typed i18n: message keys and locales are checked at compile time.
 */

import type messages from "../messages/en.json"
import type { routing } from "./i18n/routing"

declare module "next-intl" {
  // noinspection JSUnusedGlobalSymbols - read by next-intl's types (module augmentation)
  interface AppConfig {
    Locale: (typeof routing.locales)[number]
    Messages: typeof messages
  }
}
