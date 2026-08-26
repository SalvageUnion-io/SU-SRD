/* Ported from packages/component-lib/src/components/chrome/FieldError.stories.tsx. */
import { Field, FieldError, Input } from 'component-lib'
import { Group } from '../preview-lib/harness'

/**
 * The one single-message validation line.
 *
 * It replaced 22 hand-rolled `<p role="alert">` spellings that ran across two
 * colour tokens (rust vs danger) and three type sizes. Rust is the ACTION
 * colour, so `danger` is canonical for an error; the scale settles on
 * `text-caption`, matching `EmptyState`'s body copy.
 */
export function Messages() {
  return (
    <div className="max-w-md space-y-6 bg-paper p-8">
      <Group caption='on its own · role="alert"'>
        <FieldError>Pick a Chassis before saving this Pattern.</FieldError>
      </Group>
      <Group caption="wired to an input via aria-describedby">
        <Field label="Callsign">
          <Input defaultValue="" aria-describedby="callsign-error" aria-invalid />
        </Field>
        <FieldError id="callsign-error" className="mt-1">
          A Pilot needs a Callsign.
        </FieldError>
      </Group>
      <Group caption="falsy children render nothing — no empty live region">
        <FieldError>{null}</FieldError>
        <p className="font-body text-caption text-wk-muted">(nothing rendered above)</p>
      </Group>
    </div>
  )
}
