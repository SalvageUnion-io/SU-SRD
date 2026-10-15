/**
 * BoardControl — the Pilot Major's Mount bay: a split button, and the mech
 * menu its ▾ half opens (ADR-038 §3).
 *
 *  - The main half, "▶ Board <assigned mech>", boards the pilot's assigned mech
 *    (`mech-to-pilot`). When that mech can't be boarded (destroyed, someone
 *    else aboard), it is disabled and the reason is shown under it.
 *  - ▾ opens the menu over the Major (`BoardMenuList`, in the Major's overlay):
 *    every mech on the pilot's crawler, each one boardable, claimable as a
 *    spare, or disabled with the reason.
 *  - A pilot with no assigned mech gets one button, "Board a mech ▾".
 *
 * Presentational: `boardMenu.model.ts` decides what is offered, and `PilotMajor`
 * owns the menu, the claim confirm and the writes. The menu is a list of plain
 * buttons, not a `menu` role, because it is a dialog with no menu keyboard
 * model. Style objects only (ADR-046); every button is the
 * shared `Button`.
 */

import { Button, EmptyState } from 'component-lib'
import { ChevronDown } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useId, useRef } from 'react'
import type { BoardMenu, BoardOption } from './boardMenu.model'
import { boardable } from './boardMenu.model'
import { usePhoneForm } from './dashboardForm.model'

const SPLIT = { display: 'flex', gap: '2px', minWidth: 0 } satisfies CSSProperties

const MAIN = { flex: '1 1 auto', minWidth: 0, paddingInline: '8px' } satisfies CSSProperties

/**
 * A long mech name WRAPS inside its button rather than widening it or trailing
 * off: the control's label must not lose the unit's name (board D2 prints
 * "Board Scrapper" whole).
 */
const LABEL = {
  minWidth: 0,
  overflowWrap: 'anywhere',
  textAlign: 'center',
  whiteSpace: 'normal',
} satisfies CSSProperties

const CARET = { flex: '0 0 auto', minWidth: '28px', paddingInline: '6px' } satisfies CSSProperties

/** On a phone the caret holds the 44px touch floor (ruleset §4.6, ADR-045 D14). */
const PHONE_CARET = { ...CARET, minWidth: '44px' } satisfies CSSProperties

const WHOLE = { width: '100%' } satisfies CSSProperties

const NOTE = {
  margin: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-note)',
  lineHeight: 1.3,
  // ink-75: ink-50 on band-cream fails AA contrast for small text.
  color: 'var(--color-ink-75)',
} satisfies CSSProperties

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: 0,
} satisfies CSSProperties

/** What a press on an option does: board your own, or confirm a spare's claim. */
export type BoardHandlers = {
  onBoard: (mechId: string) => void
  /** A spare: the caller confirms, then claims and boards. */
  onClaim: (option: BoardOption) => void
}

function choose(option: BoardOption, { onBoard, onClaim }: BoardHandlers): void {
  if (option.state === 'spare') onClaim(option)
  else if (option.state === 'yours') onBoard(option.mechId)
}

export function BoardControl({
  menu,
  onOpenMenu,
  ...handlers
}: BoardHandlers & {
  menu: BoardMenu
  /** ▾: open the mech menu. Handed the trigger, to give focus back on close. */
  onOpenMenu: (trigger: HTMLButtonElement) => void
}) {
  const noteId = useId()
  const phone = usePhoneForm()
  const { main } = menu

  if (main === null) {
    return (
      <Button
        variant="primary"
        size="compact"
        style={WHOLE}
        aria-haspopup="dialog"
        onClick={(e) => onOpenMenu(e.currentTarget)}
      >
        Board a mech
        <ChevronDown aria-hidden="true" size={14} />
      </Button>
    )
  }

  const enabled = boardable(main)
  return (
    <div style={COLUMN}>
      <div style={SPLIT}>
        <Button
          variant="primary"
          size="compact"
          style={MAIN}
          disabled={!enabled}
          aria-describedby={enabled ? undefined : noteId}
          title={main.state === 'spare' ? `Claim and board ${main.name}` : `Board ${main.name}`}
          onClick={() => choose(main, handlers)}
        >
          <span style={LABEL}>▶ Board {main.name}</span>
        </Button>
        <Button
          variant="primary"
          size="compact"
          style={phone ? PHONE_CARET : CARET}
          aria-label="Choose a mech to board"
          aria-haspopup="dialog"
          onClick={(e) => onOpenMenu(e.currentTarget)}
        >
          <ChevronDown aria-hidden="true" size={14} />
        </Button>
      </div>
      {enabled ? null : (
        <p id={noteId} style={NOTE}>
          {main.note}
        </p>
      )}
    </div>
  )
}

/**
 * Two columns, so a crew's mechs fit the Major's height; more than that
 * scrolls the list rather than spilling it over the overlay's title.
 */
const LIST = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  alignContent: 'start',
  gap: '6px 16px',
  minHeight: 0,
  overflowY: 'auto',
  margin: 0,
  padding: '2px',
  listStyle: 'none',
} satisfies CSSProperties

const ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  minWidth: 0,
} satisfies CSSProperties

const PICK = {
  flex: '0 0 190px',
  minWidth: 0,
  justifyContent: 'flex-start',
} satisfies CSSProperties

/** What an option's button says: what pressing it does, or just the mech. */
function optionLabel(option: BoardOption): string {
  if (option.state === 'yours') return `Board ${option.name}`
  if (option.state === 'spare') return `Claim and board ${option.name}`
  return option.name
}

/**
 * The ▾ menu's body: one row per mech, the pilot's own first. Focus moves to
 * the first mech that can be boarded when it opens.
 */
export function BoardMenuList({
  options,
  ...handlers
}: BoardHandlers & { options: readonly BoardOption[] }) {
  const baseId = useId()
  const first = useRef<HTMLButtonElement>(null)
  const firstEnabled = options.findIndex(boardable)

  useEffect(() => {
    first.current?.focus()
  }, [])

  if (options.length === 0) {
    return <EmptyState variant="quiet" body="No mechs to board. Assign one on the pilot’s sheet." />
  }
  return (
    <ul style={LIST}>
      {options.map((option, i) => {
        const enabled = boardable(option)
        const noteId = `${baseId}-${i}`
        return (
          <li key={option.mechId} style={ROW}>
            <Button
              ref={i === firstEnabled ? first : undefined}
              variant={option.state === 'yours' ? 'primary' : 'default'}
              size="compact"
              style={PICK}
              disabled={!enabled}
              aria-describedby={option.note === null ? undefined : noteId}
              onClick={() => choose(option, handlers)}
            >
              <span style={LABEL}>{optionLabel(option)}</span>
            </Button>
            {option.note === null ? null : (
              <span id={noteId} style={NOTE}>
                {option.note}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
