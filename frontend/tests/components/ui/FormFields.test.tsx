import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { FormPasswordField } from "@/components/ui/FormPasswordField"
import { FormSwitch } from "@/components/ui/FormSwitch"
import { FormTextField } from "@/components/ui/FormTextField"
import { renderWithProviders } from "../../testUtils"

type Values = { note?: string; secret: string; pin?: string; enabled: boolean }

/**
 * A form with one field of each kind; `note` has no default value on purpose.
 * @returns The form.
 */
function Fields(): ReactNode {
  const { control } = useForm<Values>({ defaultValues: { secret: "hidden-value", enabled: false } })
  return (
    <form>
      <FormTextField control={control} name="note" label="Note" description="Optional" multiline />
      <FormPasswordField control={control} name="secret" label="Secret" autoComplete="new-password" />
      <FormPasswordField control={control} name="pin" label="PIN" autoComplete="current-password" />
      <FormSwitch control={control} name="enabled" label="Enabled" />
    </form>
  )
}

describe("form fields", () => {
  it("renders a text area for a field without a default value, with its description", () => {
    renderWithProviders(<Fields />)
    const note = screen.getByRole("textbox", { name: "Note" })
    expect(note.tagName).toBe("TEXTAREA")
    expect(note).toHaveValue("")
    expect(screen.getByText("Optional")).toBeInTheDocument()
    expect(screen.getByLabelText("PIN")).toHaveValue("")
  })

  it("shows and hides the password", async () => {
    renderWithProviders(<Fields />)
    const secret = screen.getByLabelText("Secret")
    expect(secret).toHaveAttribute("type", "password")

    await userEvent.click(screen.getAllByRole("button", { name: "Show password" })[0] as HTMLElement)
    expect(secret).toHaveAttribute("type", "text")
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }))
    expect(secret).toHaveAttribute("type", "password")
  })

  it("toggles a switch without a description", async () => {
    renderWithProviders(<Fields />)
    const toggle = screen.getByRole("switch", { name: "Enabled" })
    expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    expect(toggle).toBeChecked()
  })
})
