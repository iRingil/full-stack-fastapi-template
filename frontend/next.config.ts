/**
 * @file Next.js configuration.
 * @description Standalone output (a self-contained Node server in `.next/standalone`), the React Compiler and
 * next-intl. Trailing slashes are kept: FastAPI routes end with "/" and the API proxy forwards paths as they are.
 */

import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactCompiler: true,
  skipTrailingSlashRedirect: true,
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
}

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig)
