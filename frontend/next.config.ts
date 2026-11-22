/**
 * @file Next.js configuration.
 * @description Standalone output (a self-contained Node server in `.next/standalone`), the React Compiler and
 * next-intl. Trailing slashes are kept: FastAPI routes end with "/" and the API proxy forwards paths as they are.
 * The security headers (CSP, HSTS, nosniff, frame and referrer policies) are set by the reverse proxy, not here:
 * see `infrastructure/nginx`.
 */

import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactCompiler: true,
  skipTrailingSlashRedirect: true,
}

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig)
