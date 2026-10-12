import type { CSSProperties } from 'react'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Field, Input } from './Field'
import { FieldError } from './FieldError'

export default {
  title: 'Atoms/Field Error',
}

/**
 * Block flow with a bottom margin between rows, so adjoining margins collapse
 * (`Caption` brings its own 4px).
 */
const PAGE = { maxWidth: '28rem' } satisfies CSSProperties
const SECTION_GAP = { marginBottom: space[24] } satisfies CSSProperties
const ROW_GAP = { marginBottom: space[8] } satisfies CSSProperties

const NOTE = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.caption,
} satisfies CSSProperties

/**
 * FieldError — the one single-message validation line.
 *
 * It replaced 22 hand-rolled `<p role="alert">` spellings that ran across two
 * colour tokens (rust vs danger) and three type sizes. Rust is the ACTION
 * colour, so `danger` is canonical for an error; the scale settles on
 * `caption`, matching `EmptyState`'s body copy.
 */
export const Default: Story = () => (
  <div style={PAGE}>
    <div style={SECTION_GAP}>
      <Caption>on its own · role="alert"</Caption>
      <FieldError>Pick a Chassis before saving this Pattern.</FieldError>
    </div>

    <div style={SECTION_GAP}>
      <Caption>wired to an input via aria-describedby</Caption>
      <div style={ROW_GAP}>
        <Field label="Callsign">
          <Input defaultValue="" aria-describedby="callsign-error" aria-invalid />
        </Field>
      </div>
      <FieldError id="callsign-error">A Pilot needs a Callsign.</FieldError>
    </div>

    <div>
      <Caption>falsy children render nothing — no empty live region</Caption>
      <FieldError>{null}</FieldError>
      <p style={NOTE}>(nothing rendered above)</p>
    </div>
  </div>
)
