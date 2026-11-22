/**
 * @file The input variant for the fields of a container.
 * @description HeroUI's default ("primary") input has the color of a surface, so on a card or in a modal it would be
 * invisible in the dark theme; such containers wrap their content in `<SurfaceFields>` to get "secondary" inputs.
 */

"use client"

import { createContext, type ReactNode, useContext } from "react"

export type FieldVariant = "primary" | "secondary"

const FieldVariantContext = createContext<FieldVariant>("primary")

/**
 * Makes the fields inside use the input variant meant for surfaces.
 * @param props - The content.
 * @returns The content.
 */
export function SurfaceFields({ children }: { children: ReactNode }): ReactNode {
  return <FieldVariantContext value="secondary">{children}</FieldVariantContext>
}

/**
 * The input variant of the enclosing container.
 * @returns "secondary" inside `<SurfaceFields>`, otherwise "primary".
 */
export function useFieldVariant(): FieldVariant {
  return useContext(FieldVariantContext)
}
