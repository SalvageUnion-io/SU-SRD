import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'

import { FieldError } from './FieldError'
import { Field, Input } from './Field'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Field Error',
}

/**
 * FieldError — the one single-message validation line.
 *
 * It replaced 22 hand-rolled `<p role="alert">` spellings that ran across two
 * colour tokens (rust vs danger) and three type sizes. Rust is the ACTION
 * colour, so `danger` is canonical for an error; the scale settles on
 * `text-caption`, matching `EmptyState`'s body copy.
 */
export const Default: Story = () => (
  <div className="max-w-md space-y-6">
    <div className="space-y-2">
      <Caption>on its own · role="alert"</Caption>
      <FieldError>Pick a Chassis before saving this Pattern.</FieldError>
    </div>

    <div className="space-y-2">
      <Caption>wired to an input via aria-describedby</Caption>
      <Field label="Callsign">
        <Input defaultValue="" aria-describedby="callsign-error" aria-invalid />
      </Field>
      <FieldError id="callsign-error" className="mt-1">
        A Pilot needs a Callsign.
      </FieldError>
    </div>

    <div className="space-y-2">
      <Caption>falsy children render nothing — no empty live region</Caption>
      <FieldError>{null}</FieldError>
      <p className="font-body text-caption text-wk-muted">(nothing rendered above)</p>
    </div>
  </div>
)
