# FastAPI Project - Frontend

> **Note:** This project is an architectural refactoring of the original project [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template).

The frontend is a [Next.js](https://nextjs.org) application (App Router, React 19 with the React Compiler) that serves both the public, search-engine-friendly pages and the logged-in area (dashboard, items, user administration, settings).

## Stack

- **Next.js 16** — server-rendered, statically generated pages; a built-in proxy to the backend API.
- **HeroUI 3** + **Tailwind CSS 4** — accessible components (React Aria), light and dark themes.
- **TanStack Query** — server state; queries and mutations come from the generated API client.
- **next-intl** — English and Russian (`messages/*.json`), with typed message keys.
- **react-hook-form** + **zod** — forms validated with the same limits as the backend models.
- **@hey-api/openapi-ts** — the typed API client in `src/client`, generated from the backend's OpenAPI schema.
- **Vitest** + Testing Library — tests in `tests/`, mirroring `src/`; **Biome** — lint and format.

## How it talks to the backend

The browser only talks to the Next.js server, so there is no CORS and the backend need not be public:

- `/api/v1/*` is proxied to `${API_URL}/api/v1/*` (`src/app/api/v1/[...path]/route.ts`).
- `/api/auth/login` exchanges the credentials for the backend's token and keeps it in an **httpOnly cookie**;
  JavaScript never sees the token. The proxy sends it to the backend as `Authorization: Bearer`.
- `src/proxy.ts` sends anonymous visitors of protected pages to the login page and logged-in users away from it.
  A request that gets 401 (expired token) logs the user out.
- State-changing requests from another origin are rejected (CSRF).

## Getting started

Requirements: Node.js from `.nvmrc`, a running backend (see `backend/README.md`).

```bash
cp .env.example .env    # API_URL (the backend), SITE_URL (the public address of the site)
npm install
npm run dev             # http://localhost:5173
```

After changing backend routes or schemas, regenerate the client (the backend must be running) and commit `src/client`:

```bash
npm run generate-client
```

## Scripts

| Command                   | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `npm run dev`             | Development server on port 5173                       |
| `npm run build`           | Production build (`.next/standalone`)                 |
| `npm run typecheck`       | TypeScript check                                      |
| `npm run lint`            | Biome lint and format, with fixes                     |
| `npm run test`            | Vitest in watch mode; `npm run coverage` runs it once |
| `npm run generate-client` | Regenerate `src/client` from the backend's OpenAPI    |

CI (`.github/workflows/frontend.yml`) runs `npm audit`, Biome, TypeScript, the tests and the build. Test coverage of `src/`
(except the generated client) must be 100% of lines, branches, functions and statements: `npm run coverage` fails below it.

## Project structure

```
src/
├── app/                 # Routes: [locale]/(auth) public auth pages, [locale]/(app) logged-in area,
│                        # api/ (proxy and auth routes), sitemap.ts, robots.ts
├── components/
│   ├── ui/              # Primitives on top of HeroUI: form fields, dialogs, pagination
│   └── <Feature>/       # Auth, Items, Admin, UserSettings, Dashboard, Common
├── hooks/               # useAuth, useNotify, usePageParam, entity mutations
├── i18n/                # next-intl routing and navigation
├── lib/                 # API errors, validation schemas, query client, server helpers
├── client/              # Generated API client — never edit by hand
├── styles/globals.css   # Tailwind + HeroUI theme (brand colors go here)
└── proxy.ts             # Page access rules + locale routing
```

## Deployment

`npm run build` produces a self-contained server in `.next/standalone`. Copy the static files next to it and run it
with Node (for example under pm2 or systemd):

```bash
npm ci && npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
cd .next/standalone && PORT=5173 API_URL=http://127.0.0.1:8000 SITE_URL=https://example.com node server.js
```

- `API_URL` and `SITE_URL` are read at runtime, so one build serves any environment.
- Behind a reverse proxy (nginx) pass `Host` and `X-Forwarded-For` to Next.js; run the backend's Uvicorn with
  `--proxy-headers`, so that its rate limiter sees the visitor's IP rather than the Next.js server's.
- Set the backend's `FRONTEND_HOST` to the site's address: it builds the links in the emails.
