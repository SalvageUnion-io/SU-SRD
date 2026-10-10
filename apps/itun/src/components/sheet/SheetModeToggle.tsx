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

const GROUP = {
  borderColor: tokens.color.ink,
  borderRadius: tokens.radius.card,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  display: 'inline-flex',
  overflow: 'hidden',
} satisfies CSSProperties

const BUTTON = {
  backgroundColor: tokens.color.paper,
  border: 0,
  color: tokens.color.ink,
  cursor: 'pointer',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.lede,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsTight,
  minHeight: '40px',
  padding: `0 ${tokens.space[16]}`,
  textTransform: 'uppercase',
} satisfies CSSProperties

const ON = {
  ...BUTTON,
  backgroundColor: tokens.color.ink,
  color: tokens.color.paper,
} satisfies CSSProperties

export function SheetModeToggle({
  mode,
  kind,
  editDisabled = false,
}: {
  mode: SheetMode
  kind: string
  /**
   * Edit is not on offer (the Starter Set's templates, which nobody edits):
   * the control still prints, so the sheet reads the same, with Edit off.
   */
  editDisabled?: boolean
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics to two toggle buttons
    <div role="group" aria-label={`Read or edit this ${kind}`} style={GROUP}>
      <button
        type="button"
        aria-pressed={!mode.editing}
        className="su-focus-ring"
        style={mode.editing ? BUTTON : ON}
        onClick={() => mode.setEditing(false)}
      >
        Read
      </button>
      <button
        type="button"
        aria-pressed={mode.editing}
        disabled={editDisabled}
        title={editDisabled ? 'Make a copy to edit' : undefined}
        className="su-focus-ring"
        style={
          editDisabled
            ? { ...BUTTON, cursor: 'not-allowed', opacity: 0.5 }
            : mode.editing
              ? ON
              : BUTTON
        }
        onClick={() => mode.setEditing(true)}
      >
        Edit
      </button>
    </div>
  )
}
