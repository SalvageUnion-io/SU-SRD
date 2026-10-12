/**
 * SheetModeToggle — the sheet band's Read | Edit (board 10; `sheetMode.ts`).
 *
 * Two buttons joined into one ink-framed control: the state you are in is the
 * ink plate, the other is paper. `aria-pressed` carries the state, so a screen
 * reader hears which of the two is on.
 */

import { tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { SheetMode } from './sheetMode'

/** The pair's row. The frame is the buttons' own, so the toggle stands exactly
 * as tall as its neighbours (`.su-page-action`); a frame on this row would add
 * its two borders on top. */
const GROUP = {
  display: 'inline-flex',
} satisfies CSSProperties

const BUTTON = {
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  color: tokens.color.ink,
  cursor: 'pointer',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.lede,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsTight,
  padding: `0 ${tokens.space[16]}`,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The leading half: the frame's left corners. */
const FIRST = {
  ...BUTTON,
  borderEndStartRadius: tokens.radius.card,
  borderStartStartRadius: tokens.radius.card,
} satisfies CSSProperties

/** The trailing half: its right corners, and no left border to double the seam. */
const LAST = {
  ...BUTTON,
  borderEndEndRadius: tokens.radius.card,
  borderInlineStartWidth: 0,
  borderStartEndRadius: tokens.radius.card,
} satisfies CSSProperties

const ON = {
  backgroundColor: tokens.color.ink,
  color: tokens.color.paper,
} satisfies CSSProperties

const FIRST_ON = { ...FIRST, ...ON } satisfies CSSProperties
const LAST_ON = { ...LAST, ...ON } satisfies CSSProperties

/**
 * Only on a sheet the viewer may write: a read-only sheet has nothing to switch
 * to, so it prints no toggle (`Sheet.tsx`).
 */
export function SheetModeToggle({ mode, kind }: { mode: SheetMode; kind: string }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics to two toggle buttons
    <div role="group" aria-label={`Read or edit this ${kind}`} style={GROUP}>
      <button
        type="button"
        aria-pressed={!mode.editing}
        className="su-focus-ring su-page-action"
        style={mode.editing ? FIRST : FIRST_ON}
        onClick={() => mode.setEditing(false)}
      >
        Read
      </button>
      <button
        type="button"
        aria-pressed={mode.editing}
        className="su-focus-ring su-page-action"
        style={mode.editing ? LAST_ON : LAST}
        onClick={() => mode.setEditing(true)}
      >
        Edit
      </button>
    </div>
  )
}
