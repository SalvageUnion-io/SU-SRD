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
 * Presentational: `boardMenu.ts` decides what is offered, and `PilotMajor`
 * owns the menu, the claim confirm and the writes. The menu is a list of plain
 * buttons, not a `menu` role, because it is a dialog with no menu keyboard
 * model. Style objects only (tailwind-removal.md §4); every button is the
 * shared `Button`.
 */

import { Button } from 'component-lib'
import type { CSSProperties } from 'react'
import { useEffect, useId, useRef } from 'react'
import type { BoardMenu, BoardOption } from './boardMenu'
import { boardable } from './boardMenu'

const SPLIT: CSSProperties = { display: 'flex', gap: '2px', minWidth: 0 }

const MAIN: CSSProperties = { flex: '1 1 auto', minWidth: 0, paddingInline: '8px' }

/** A long mech name trails off inside its button rather than widening it. */
const LABEL: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const CARET: CSSProperties = { flex: '0 0 auto', minWidth: '28px', paddingInline: '6px' }

const WHOLE: CSSProperties = { width: '100%' }

const NOTE: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-note)',
  lineHeight: 1.3,
  // ink-75: ink-50 on band-cream fails AA contrast for small text.
  color: 'var(--color-ink-75)',
}

const COLUMN: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }

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
        Board a mech ▾
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
          style={CARET}
          aria-label="Choose a mech to board"
          aria-haspopup="dialog"
          onClick={(e) => onOpenMenu(e.currentTarget)}
        >
          ▾
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
const LIST: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  alignContent: 'start',
  gap: '6px 16px',
  minHeight: 0,
  overflowY: 'auto',
  margin: 0,
  padding: '2px',
  listStyle: 'none',
}

const ROW: CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }

const PICK: CSSProperties = { flex: '0 0 190px', minWidth: 0, justifyContent: 'flex-start' }

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
    return <p style={NOTE}>No mechs to board. Assign one on the pilot’s sheet.</p>
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
