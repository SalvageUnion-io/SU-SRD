/**
 * DashboardPhone — the Dashboard's phone form (ADR-045, boards D4 and D5):
 * what `DashboardCanvas` renders when the fixed canvas would draw below its
 * legibility floor on either axis.
 *
 * One column that scrolls, top to bottom:
 *
 *  - **The bar** (the ground, `--color-ink-deep`, sticky): the SU stamp back
 *    to the Game hub, "GAME · {name}", search and ≡.
 *  - **Unit tabs** in a fixed order, Pilot · Mech · Crawler (src/ui
 *    `Tabs`). The selected tab is the Major when the Dashboard opens and
 *    follows it when the mount changes; otherwise only the player moves it.
 *    A tab whose Minor reports a problem carries ▲, spelled out in its name.
 *  - **Pinned vitals** under the tabs, on every tab but the Major's (D8).
 *  - **The tab body** (the chassis, `--color-band-cream`): the unit's tone
 *    band, then its Major's controls (`PhoneMajorFrame`), with the deck on
 *    the Major's tab.
 *
 * While a resolve is open the resolve screen (`PhoneResolve`) replaces all of
 * it. A mount change moves focus to the new tab's heading, since the control
 * that caused it is gone, and says so in a polite live region. Closing the
 * resolve screen hands focus back to the pennant, row or resume row that
 * opened it.
 *
 * Presentational: `Dashboard.tsx` owns the state and builds every part. A
 * read-only session (Disconnected, Outdated) disables every control under
 * the tabs at once, through one `fieldset`, and says why.
 */

import { Menu, Search } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  borderWidth,
  color,
  font,
  fontSize,
  space,
  tracking,
  weight,
} from '../../../ui/design/tokens'
import { Button, Tab, TabList, TabPanel, Tabs } from '../../../ui/index'
import { MARK_SRC } from '../../lib/appUrl'
import { AppLink } from '../shared/AppLink'
import type { PinnedVital } from './PinnedVitals'
import { PinnedVitals } from './PinnedVitals'
import type { SlotKind } from './slotLayout.model'

/** The order never changes, so a thumb learns it (D4). */
const PHONE_TABS: readonly { kind: SlotKind; label: string }[] = [
  { kind: 'pilot', label: 'Pilot' },
  { kind: 'mech', label: 'Mech' },
  { kind: 'crawler', label: 'Crawler' },
]

export type PhoneUnit = {
  /** The entity's name, or null when the pilot has none (no mech, no crawler). */
  name: string | null
  /** The Minor's problems: an injury, a damaged system, a damaged bay. */
  problems: readonly string[]
  /** The tab's body: the unit's Major, or where to fix a missing one. */
  body: ReactNode
}

/** What opened the resolve screen, so focus can go back to it (D14). */
export type ResolveOpener = { kind: 'pennant' | 'row' | 'resume'; key: string }

const FAM_BAND: Record<SlotKind, string> = {
  pilot: color.pilot,
  mech: color.mech,
  crawler: color.crawler,
}

/** The open form is a centred column on a wide host (a tablet, a short window). */
const ROOT = { maxWidth: '600px', margin: '0 auto', minWidth: 0 } satisfies CSSProperties

const STICKY = { position: 'sticky', top: 0, zIndex: 3 } satisfies CSSProperties

const BAR = {
  display: 'flex',
  alignItems: 'center',
  gap: space[4],
  minHeight: '52px',
  padding: `0 ${space[4]}`,
  background: color.inkDeep,
  color: color.paper,
  borderBottom: `${borderWidth.hairline} solid ${color.paper15}`,
} satisfies CSSProperties

const STAMP_LINK = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '44px',
  minHeight: '44px',
} satisfies CSSProperties

const GAME = {
  flex: 1,
  minWidth: 0,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.lede,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

const BAR_KEY = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '44px',
  minHeight: '44px',
  padding: 0,
  border: 0,
  background: 'transparent',
  color: color.paper,
  cursor: 'pointer',
} satisfies CSSProperties

const BADGE = {
  position: 'absolute',
  top: '4px',
  right: '2px',
  minWidth: '16px',
  padding: `0 ${space[2]}`,
  borderRadius: '8px',
  background: color.paper,
  color: color.ink,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  lineHeight: '16px',
} satisfies CSSProperties

const WARN_GLYPH = {
  position: 'absolute',
  bottom: '4px',
  right: '4px',
  color: color.statusBad,
  fontSize: fontSize.badge,
} satisfies CSSProperties

const TABS = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 0,
  background: color.paper,
  borderBottom: `${borderWidth.chrome} solid ${color.ink}`,
} satisfies CSSProperties

const TAB = {
  minHeight: '48px',
  borderRadius: 0,
  borderWidth: `0 ${borderWidth.hairline} 0 0`,
  fontSize: fontSize.caption,
} satisfies CSSProperties

const TAB_WARN = { ...TAB, boxShadow: `inset 0 0 0 2px ${color.statusBad}` } satisfies CSSProperties

const ATTENTION = { marginLeft: space[4], color: color.statusBad } satisfies CSSProperties

const PINNED = {
  padding: `${space[6]} ${space[12]}`,
  background: color.bandCream,
  borderBottom: `${borderWidth.hairline} solid ${color.ink20}`,
} satisfies CSSProperties

const PLAIN = { border: 0, margin: 0, padding: 0, minWidth: 0 } satisfies CSSProperties

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  padding: `0 ${space[12]} ${space[24]}`,
  background: color.bandCream,
} satisfies CSSProperties

const BAND_WRAP = (kind: SlotKind): CSSProperties => ({
  margin: `0 -${space[12]}`,
  padding: `${space[12]} ${space[12]} 0`,
  background: FAM_BAND[kind],
})

const BAND_NAME = {
  display: 'inline-block',
  maxWidth: '100%',
  margin: 0,
  padding: `${space[4]} ${space[8]} 0`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  background: color.bandCream,
  fontFamily: font.cond,
  fontWeight: weight.extrabold,
  fontSize: fontSize.hero,
  lineHeight: 1.1,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink,
  outline: 'none',
} satisfies CSSProperties

const NOTE = {
  margin: 0,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink,
} satisfies CSSProperties

const RESUME = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  minHeight: '48px',
  padding: `0 ${space[12]}`,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  background: color.paper,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.caption,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink,
  cursor: 'pointer',
} satisfies CSSProperties

/** Focus the pennant, row or resume row that opened the resolve screen. */
function refocus(root: HTMLElement | null, opener: ResolveOpener | null) {
  if (!root) return
  const row =
    opener && opener.kind !== 'resume'
      ? root.querySelector<HTMLElement>(`[data-deck-key="${CSS.escape(opener.key)}"]`)
      : null
  const target =
    (opener?.kind === 'pennant' ? row?.querySelector<HTMLElement>('.su-ec-pennant-btn') : null) ??
    row?.querySelector<HTMLElement>('[role="button"]') ??
    root.querySelector<HTMLElement>('[data-resume]')
  target?.focus()
}

export function DashboardPhone({
  gameName,
  homeHref,
  major,
  mountKey,
  mountNote,
  tab,
  onTab,
  units,
  pinned,
  readOnly,
  resume,
  resolveScreen,
  opener,
  crewAttention,
  inbox,
  onSearch,
  onMenu,
  menu,
}: {
  gameName: string | null
  /** The SU stamp's target: the Game hub. */
  homeHref: string
  /** Which unit is Major (ADR-038 §3). */
  major: SlotKind
  /** Changes whenever the mount does: Board, Dismount, Eject, Downtime. */
  mountKey: string
  /** What a mount change announces: "Boarded Scrapper", "On foot". */
  mountNote: string
  tab: SlotKind
  onTab: (tab: SlotKind) => void
  units: Record<SlotKind, PhoneUnit>
  /** The Major's spend vitals, pinned under the tabs on the other tabs (D8). */
  pinned: PinnedVital[]
  /** Why nothing can be pressed (Disconnected, Outdated), or null. */
  readOnly: string | null
  /** A resolve left open on the seat: the Major's tab offers it back. */
  resume: { name: string; onResume: () => void } | null
  /** The resolve screen while it is open, which replaces everything below. */
  resolveScreen: ReactNode | null
  opener: ResolveOpener | null
  crewAttention: boolean
  /** Proposals waiting for this player. */
  inbox: number
  onSearch: () => void
  onMenu: () => void
  /** The ≡ menu (`PhoneMenu`), mounted beside the form. */
  menu: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [announce, setAnnounce] = useState('')

  // A mount change: the control that caused it unmounted with its tab, so
  // focus goes to the new tab's heading, and the change is announced (D14).
  const lastMount = useRef(mountKey)
  useEffect(() => {
    if (lastMount.current === mountKey) return
    lastMount.current = mountKey
    setAnnounce(mountNote)
    heading.current?.focus()
  }, [mountKey, mountNote])

  // The resolve screen closed: back to whatever opened it.
  const wasResolving = useRef(resolveScreen !== null)
  useEffect(() => {
    const resolving = resolveScreen !== null
    if (wasResolving.current && !resolving) refocus(root.current, opener)
    wasResolving.current = resolving
  }, [resolveScreen, opener])

  const live = (
    <p aria-live="polite" className="su-sr-only">
      {announce}
    </p>
  )

  if (resolveScreen !== null) {
    return (
      <div ref={root} style={ROOT}>
        {live}
        {resolveScreen}
        {menu}
      </div>
    )
  }

  return (
    <div ref={root} style={ROOT}>
      {live}
      <Tabs value={tab} onValueChange={onTab}>
        <div style={STICKY}>
          <header style={BAR}>
            <AppLink href={homeHref} aria-label="Return to the Game hub" style={STAMP_LINK}>
              <img src={MARK_SRC} alt="" width={28} height={28} />
            </AppLink>
            <p style={GAME}>{gameName ? `Game · ${gameName}` : 'Dashboard'}</p>
            <Button
              variant="quiet"
              size="iconOnly"
              style={BAR_KEY}
              aria-label="Search the SRD"
              onClick={onSearch}
            >
              <Search size={22} aria-hidden="true" />
            </Button>
            <Button
              variant="quiet"
              size="iconOnly"
              style={BAR_KEY}
              aria-label={`Menu${crewAttention ? ', the crew needs attention' : ''}${
                inbox > 0 ? `, ${inbox} proposal${inbox === 1 ? '' : 's'} waiting` : ''
              }`}
              aria-haspopup="dialog"
              onClick={onMenu}
            >
              <Menu size={24} aria-hidden="true" />
              {inbox > 0 ? (
                <span aria-hidden="true" style={BADGE}>
                  {inbox}
                </span>
              ) : null}
              {crewAttention ? (
                <span aria-hidden="true" style={WARN_GLYPH}>
                  ▲
                </span>
              ) : null}
            </Button>
          </header>
          <TabList label="Units" style={TABS}>
            {PHONE_TABS.map((t) => {
              const warn = t.kind !== tab && units[t.kind].problems.length > 0
              return (
                <Tab key={t.kind} value={t.kind} style={warn ? TAB_WARN : TAB}>
                  {t.label}
                  {warn ? (
                    <>
                      <span aria-hidden="true" style={ATTENTION}>
                        ▲
                      </span>
                      <span className="su-sr-only">, needs attention</span>
                    </>
                  ) : null}
                </Tab>
              )
            })}
          </TabList>
          {tab !== major && pinned.length > 0 && (
            <div style={PINNED}>
              <PinnedVitals vitals={pinned} />
            </div>
          )}
        </div>
        {PHONE_TABS.map((t) => {
          const unit = units[t.kind]
          return (
            <TabPanel key={t.kind} value={t.kind} style={BODY}>
              <div style={BAND_WRAP(t.kind)}>
                <h2 ref={heading} tabIndex={-1} style={BAND_NAME}>
                  {unit.name ?? t.label}
                </h2>
              </div>
              {readOnly && <p style={NOTE}>{readOnly}</p>}
              {/* Outside the read-only fieldset: a resolve stays readable. */}
              {t.kind === major && resume && (
                <button type="button" data-resume style={RESUME} onClick={resume.onResume}>
                  <span>Resolving · {resume.name}</span>
                  <span aria-hidden="true">›</span>
                </button>
              )}
              <fieldset disabled={readOnly !== null} style={PLAIN}>
                <legend className="su-sr-only">{`${t.label} controls`}</legend>
                {unit.body}
              </fieldset>
            </TabPanel>
          )
        })}
      </Tabs>
      {menu}
    </div>
  )
}
