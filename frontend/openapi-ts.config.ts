/**
 * @file Configuration of the API client generator (`npm run generate-client`).
 * @description Reads the OpenAPI schema of the running backend (`API_URL`, default http://127.0.0.1:8000) and
 * writes a fetch client, SDK functions and TanStack Query options into `src/client`.
 */

import { defineConfig } from "@hey-api/openapi-ts"

const apiUrl: string = process.env.API_URL ?? "http://127.0.0.1:8000"

export default defineConfig({
  input: `${apiUrl}/api/v1/openapi.json`,
  parser: {
    // The private router exists only for local seeding, the frontend never calls it
    filters: { tags: { exclude: ["private"] } },
    // Operation IDs are "{tag}-{Router}.{route}" (AppFactory._custom_generate_unique_id): keep only the route name,
    // so "users-UsersRouter.read_users" becomes readUsers
    patch: {
      operations: (_method: string, _path: string, operation: { operationId?: string }): void => {
        operation.operationId = operation.operationId?.split(".").at(-1)
      },
    },
  },
  output: { path: "./src/client", postProcess: ["biome:format"] },
  plugins: [
    // No base URL from the schema's servers: the browser calls the Next.js server on its own origin, never the backend
    { name: "@hey-api/client-fetch", baseUrl: false },
    "@hey-api/typescript",
    "@hey-api/sdk",
    "@tanstack/react-query",
  ],
})
