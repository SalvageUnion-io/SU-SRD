/**
 * PhoneMenu — the phone bar's ≡ (ADR-044 D9): the canvas display's other
 * tabs, the strip and the Mediator's Downtime control, as one full-height
 * `ModalShell`.
 *
 * In order: the Game (latest alert, proposals, saved state), Log and Crew,
 * Reference, Tables and SRD, the Mediator's Start or End Downtime, and the
 * way back to the Game. A panel item opens that panel full-screen inside the
 * same dialog, with ‹ back to the menu; the panels are the canvas's own
 * components, unchanged. The bar's search opens straight onto the SRD panel
 * with its search box focused.
 *
 * `ModalShell` traps focus, closes on Escape and hands focus back to ≡ or
 * search. The dialog portals out of the Dashboard, so its content carries the
 * `.pc-root` scope the panels' `.pc-*` rules key off.
 */

import { Button, buttonVariants, ModalShell } from 'component-lib'
import {
  borderWidth,
  color,
  font,
  fontSize,
  space,
  tracking,
  weight,
} from 'component-lib/design/tokens'
import { ChevronLeft, X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { AppLink } from '../shared/AppLink'

export type PhonePanel = 'log' | 'crew' | 'reference' | 'tables' | 'srd'

/** What the menu shows: its list, or one panel. */
export type PhoneMenuView = 'menu' | PhonePanel

const PANEL_TITLE: Record<PhonePanel, string> = {
  log: 'Log',
  crew: 'Crew',
  reference: 'Reference',
  tables: 'Tables',
  srd: 'SRD',
}

const SHEET: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100%',
  maxWidth: '600px',
  margin: '0 auto',
  background: color.paper,
}

const HEAD: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  gap: space[8],
  padding: space[4],
  background: color.inkDeep,
  color: color.paper,
}

const TITLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  margin: 0,
  paddingInline: space[8],
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.readout,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  outline: 'none',
}

const ICON: CSSProperties = { minWidth: '44px', minHeight: '44px', color: color.paper }

const LIST: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  padding: space[16],
}

const GROUP: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space[8],
}

const GAME: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  padding: space[8],
  border: `${borderWidth.chrome} solid ${color.ink20}`,
}

const ITEM: CSSProperties = { width: '100%', minHeight: '48px' }

const ATTENTION: CSSProperties = { marginLeft: space[6], color: color.statusBad }

/** Visually hidden, still read: the word a ▲ stands for. */
const HIDDEN: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
}

/** A panel fills the rest of the screen; the canvas's panels scroll inside it. */
const BODY: CSSProperties = { position: 'relative', flex: 1, minHeight: '70dvh' }

export function PhoneMenu({
  open,
  view,
  onView,
  onClose,
  game,
  crewAttention,
  panels,
  downtimeAction,
  gameHref,
}: {
  open: boolean
  view: PhoneMenuView
  onView: (view: PhoneMenuView) => void
  onClose: () => void
  /** The Game: the strip's alert and proposals, and the saved state. */
  game: ReactNode
  /** Someone on the crew needs looking at: ▲ on Crew. */
  crewAttention: boolean
  panels: Record<PhonePanel, ReactNode>
  /** The Mediator's Start or End Downtime; absent for a player. */
  downtimeAction?: { label: string; title: string; onClick: () => void }
  /** The Game's own page, when it is known. */
  gameHref: string | null
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)

  // A new view takes focus at its heading; the SRD panel at its search box,
  // which is what the bar's search opened it for. A frame later, so Base UI's
  // own initial focus (on open) has run first.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const search = view === 'srd' ? body.current?.querySelector<HTMLElement>('input') : null
      ;(search ?? heading.current)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, view])

  const item = (panel: PhonePanel, attention = false) => (
    <Button variant="default" size="full" style={ITEM} onClick={() => onView(panel)}>
      {PANEL_TITLE[panel]}
      {attention ? (
        <>
          <span aria-hidden="true" style={ATTENTION}>
            ▲
          </span>
          <span style={HIDDEN}>, needs attention</span>
        </>
      ) : null}
    </Button>
  )

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={view === 'menu' ? 'Dashboard menu' : PANEL_TITLE[view]}
      bare
      fullscreen
    >
      <div className="pc-root su-dash-phone" style={SHEET}>
        <div style={HEAD}>
          {view !== 'menu' && (
            <Button
              variant="ghost"
              size="iconOnly"
              style={ICON}
              aria-label="Back to the menu"
              onClick={() => onView('menu')}
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </Button>
          )}
          <h2 ref={heading} tabIndex={-1} style={TITLE}>
            {view === 'menu' ? 'Menu' : PANEL_TITLE[view]}
          </h2>
          <Button
            variant="ghost"
            size="iconOnly"
            style={ICON}
            aria-label="Close the menu"
            onClick={onClose}
          >
            <X size={22} aria-hidden="true" />
          </Button>
        </div>
        {view === 'menu' ? (
          <nav aria-label="Dashboard" style={LIST}>
            <div style={GAME}>{game}</div>
            <div style={GROUP}>
              {item('log')}
              {item('crew', crewAttention)}
            </div>
            <div style={GROUP}>
              {item('reference')}
              {item('tables')}
              {item('srd')}
            </div>
            {downtimeAction && (
              <Button
                variant="default"
                size="full"
                style={ITEM}
                title={downtimeAction.title}
                onClick={() => {
                  onClose()
                  downtimeAction.onClick()
                }}
              >
                {downtimeAction.label}
              </Button>
            )}
            <AppLink
              href={gameHref ?? '/'}
              className={buttonVariants({ variant: 'ghost', size: 'full' })}
              style={ITEM}
            >
              Return to Game
            </AppLink>
          </nav>
        ) : (
          <div ref={body} style={BODY}>
            {panels[view]}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
