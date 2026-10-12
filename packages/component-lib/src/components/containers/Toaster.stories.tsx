import type { CSSProperties } from 'react'
import { color, font, fontSize, radius, space, tracking } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { buttonVariants } from '../atoms/buttonVariants'
import { Toaster, toast } from './Toaster'

export default {
  title: 'Containers/Toaster',
}

// Ruleset §Toast: an off-white chip — status swatch + message + rust dismiss.
// Each button below fires a real `toast(...)` so the container is interactive.

const CAPTION = {
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  textTransform: 'uppercase',
  letterSpacing: tracking.caps,
  color: color.wkMuted,
} satisfies CSSProperties

const STACK = { display: 'flex', flexDirection: 'column', gap: space[12] } satisfies CSSProperties
const ROW = { display: 'flex', flexWrap: 'wrap', gap: space[12] } satisfies CSSProperties

/** A trigger filled in the tone of the toast it raises. */
function fill(backgroundColor: string): CSSProperties {
  return {
    borderRadius: radius.card,
    backgroundColor,
    padding: `${space[8]} ${space[16]}`,
    fontFamily: font.cond,
    textTransform: 'uppercase',
    letterSpacing: tracking.capsTight,
    color: color.paper,
  }
}

export const Default: Story = () => (
  <>
    <Toaster />
    <div style={STACK}>
      <span style={CAPTION}>
        status swatch + message + rust dismiss · fires a real toast, bottom-right
      </span>
      <div style={ROW}>
        <button
          type="button"
          style={fill(color.statusOk)}
          onClick={() =>
            toast.success('Saved to workspace.', {
              description: 'Your build is up to date.',
            })
          }
        >
          Success
        </button>
        <button
          type="button"
          style={fill(color.statusBad)}
          onClick={() =>
            toast.error('Save failed.', {
              description: 'Could not reach local storage.',
            })
          }
        >
          Error
        </button>
        <button type="button" style={fill(color.ink)} onClick={() => toast('Nothing to report.')}>
          Default
        </button>
      </div>
    </div>
  </>
)

export const Dismiss: Story = () => (
  <>
    <Toaster />
    <div style={STACK}>
      <span style={CAPTION}>rust = the dismiss action · raise a sticky toast, then clear it</span>
      <div style={ROW}>
        <button
          type="button"
          style={fill(color.ink)}
          onClick={() =>
            toast('Salvage pending…', {
              description: 'This chip stays until dismissed.',
              duration: Number.POSITIVE_INFINITY,
            })
          }
        >
          Raise sticky
        </button>
        <button
          type="button"
          className={buttonVariants({ variant: 'primary', size: 'compact' })}
          onClick={() => toast.dismiss()}
        >
          Dismiss
        </button>
      </div>
    </div>
  </>
)
