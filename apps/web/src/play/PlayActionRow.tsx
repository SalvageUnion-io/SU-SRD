/**
 * PlayActionRow — one action in the Actions list (play.md §5, R65): the
 * action's contentful Mini in the list's Mini grid (ruleset §1.3: Play's
 * lists are Minis), its Mini chips in the shared stat order with the cost
 * last. Its row is the shared one (`actionRow`): the owner's picks and the
 * crawler's Tech Level applied, its text the action's effect alone.
 *
 *  - **Closed** it says its effect in at most two short lines
 *    (`.su-play-act__effect`); an action whose chips say it all is its head
 *    alone. Its name Peeks and opens the entry it comes from (the ability,
 *    item or chassis: `actionRow`'s source), as a link-mode Mini.
 *  - **On hand** it carries a rust Use (ruleset §1.4), which opens the resolve
 *    in place in the Mini's body (N3): the whole effect, its picks as CHOSEN
 *    chips (R60), then `PlayResolveSteps`, with Cancel in Use's place. A
 *    Passive is always on and carries none.
 *  - **Not on hand** it is dimmed, and says what it needs as a chip ("needs
 *    Boarded"); an action it cannot use now (locked, or read-only) is faded
 *    too.
 *
 * From `lg` Use sits after the cost in the head's chip group (C8). Below it
 * the head is the name's and the chips' alone, so a long name is never cut
 * for a button: Use ends the body's line, beside the effect, a Compact button
 * pressed through a Full Size (44px) target (`.su-play-act__use`).
 *
 * Its band is its source unit's tone dulled (pilot or mech, never black); a
 * companion's rows wear its own Mini's tone, as the Units column draws it,
 * and name it as a relation chip (C11).
 *
 * When its resolve closes (Apply, Done), the keyboard is back on its Use.
 *
 * A Mini nests nothing (E6): the resolve inside it, its roll instrument (R8)
 * and its steps, is plain content, never an entity of its own (play.md §12).
 */

import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button, Entity, Stat, TraitProse } from '../components/index'
import { actionRow } from '../lib/rules/actionRow'
import { atomsCopy } from '../messages/components-atoms'
import { playCopy } from '../messages/play'
import type { ResolveModel } from './actionsDeck.model'
import { PlayResolveSteps } from './PlayResolveSteps'
import type { ListEntry } from './playActions.model'
import { NEED_TEXT } from './playActions.model'
import { ROLL_BUTTON } from './useFindKey'
import { usePlayWide } from './usePlayWide'

type ActionEntry = Extract<ListEntry, { kind: 'action' }>

/** The head opens its source's Page (E5), the surface's opener. */
const OPENS_SOURCE = { kind: 'link' } as const

type PlayActionRowProps = {
  entry: ActionEntry
  /** The seat's resolve, when it is this action's; null otherwise. */
  resolve: Extract<ResolveModel, { kind: 'resolve' }> | null
  /** It just finished and closed itself: the row says Done. */
  done?: boolean
  /** What a done row says it came to: "Result applied", or its roll (r6 A5). */
  doneSays?: string
  onUse: () => void
  canWrite: boolean
  /** Why it cannot run as it stands (out of range, over the Heat Cap), or null. */
  locked: string | null
  /** Not to be used at all now (a Down Mech's, r6 A7): the lock says why, and no Use is offered. */
  unavailable?: boolean
  /** The pilot's crawler Tech Level: an item's action scales with it (Custom Sniper Rifle damage). */
  techLevel?: number | undefined
  /** The row sits under its action type's heading, so its head leaves the type out (C10). */
  grouped?: boolean
  /** The Uses it has left and counts from, where it counts them (r4 A2). */
  uses?: { left: number; max: number } | null
  /** It needs power its Mech has not (Shut down, r7 B2): its Use says so, off. */
  unpowered?: string | null
}

/**
 * A closed row's effect, two lines at most; one cut short says so with a
 * More that opens it in place, and a Less that closes it.
 */
function RowEffect({ text, name }: { text: string; name: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  const [cut, setCut] = useState(false)
  // Measured after every render: the text, and the width it wraps in, decide.
  useLayoutEffect(() => {
    const p = box.current?.firstElementChild
    setCut(p instanceof HTMLElement && p.scrollHeight > p.clientHeight + 1)
  })
  return (
    <div ref={box} className="su-play-act__effect-box" data-full={full || undefined}>
      <TraitProse as="p" className="su-play-act__effect" text={text} />
      {(cut || full) && (
        <Button
          variant="ghost"
          // The Tabs' height, as every Button in the Actions band (R12).
          size="compact"
          aria-expanded={full}
          // Its own name, beside the bar's More: "More of Jury Rig".
          aria-label={playCopy(full ? 'lessOf' : 'moreOf', { name })}
          onClick={() => setFull(!full)}
        >
          {atomsCopy(full ? 'less' : 'more')}
        </Button>
      )}
    </div>
  )
}

/** Why a line is not on hand ("needs Boarded"), as its state chip (C8). */
export function NeedChip({ need }: { need: string }) {
  return <Stat size="mini" label={need} />
}

/**
 * Why a line cannot run as it stands ("Out of Range at Long"), said as its
 * state chip, never only a hover title a phone can't read. Destroyed says so
 * already, in the line's own condition.
 */
function lockChip(locked: string | null, condition: string | undefined) {
  return locked === null || condition === 'destroyed' ? {} : { state: <NeedChip need={locked} /> }
}

export function PlayActionRow({
  entry,
  resolve,
  done = false,
  doneSays = playCopy('resultApplied'),
  onUse,
  canWrite,
  locked,
  unavailable = false,
  techLevel,
  grouped = false,
  uses = null,
  unpowered = null,
}: PlayActionRowProps) {
  const usesLeft = uses?.left
  const usesMax = uses?.max
  const { model, summary, picks } = useMemo(
    () =>
      actionRow(entry.action, {
        techLevel,
        grouped,
        uses:
          usesLeft === undefined || usesMax === undefined ? null : { left: usesLeft, max: usesMax },
      }),
    [entry.action, techLevel, grouped, usesLeft, usesMax]
  )
  // A name two of the list's actions share says whose this one is (r7 B5).
  const titled = entry.name === entry.action.name ? model : { ...model, title: entry.name }
  const wide = usePlayWide()
  const companion = entry.action.companion
  const open = resolve !== null
  // Closing takes the pressed control (Apply, Done) away with the resolve:
  // the keyboard goes back to this row's Use, or End my turn while it is the
  // player's turn, never to the page's top (r4 A3, r6 A13).
  const rowRef = useRef<HTMLLIElement>(null)
  const wasOpen = useRef(open)
  useEffect(() => {
    const opened = !wasOpen.current && open
    const closed = wasOpen.current && !open
    wasOpen.current = open
    const row = rowRef.current
    const active = document.activeElement
    // Use pressed from the keyboard: on to Roll, never left on Cancel (r6 A13).
    if (opened && row !== null && active !== null && row.contains(active)) {
      row.querySelector<HTMLElement>(ROLL_BUTTON)?.focus()
      return
    }
    if (closed && (active === null || active === document.body || !active.isConnected)) {
      // The player who is up goes on to End my turn, one Tab from the strip (r6 A13).
      const end = document.querySelector<HTMLButtonElement>('[data-end-turn]:not([disabled])')
      ;(end ?? row?.querySelector<HTMLElement>('.su-play-act__use'))?.focus()
    }
  }, [open])
  const away = entry.need !== null
  const size = wide ? 'mini' : 'compact'
  const control =
    away || entry.type === 'Passive' || (unavailable && !open) ? null : open ? (
      <Button
        size={size}
        className="su-play-act__use"
        onClick={resolve.onBack}
        // Closing never undoes a spend, so once anything was done it reads Done.
        aria-label={
          resolve.progressed
            ? playCopy('actionDone2', { name: entry.name })
            : playCopy('cancel2', { name: entry.name })
        }
      >
        {resolve.progressed ? playCopy('actionDone') : playCopy('cancel')}
      </Button>
    ) : (
      <Button
        size={size}
        // A faded row's Use is ink: the accent does not hold its contrast dimmed.
        variant={locked !== null || !canWrite || unpowered !== null ? 'ink' : 'primary'}
        className="su-play-act__use"
        onClick={onUse}
        disabled={!canWrite || unpowered !== null}
        aria-label={
          unpowered === null
            ? playCopy('use2', { name: entry.name })
            : playCopy('useUnpowered', { name: entry.name, why: unpowered })
        }
      >
        {unpowered ?? playCopy('use')}
      </Button>
    )
  const effect = !open && summary ? <RowEffect text={summary} name={entry.name} /> : null
  // Below `lg` the control ends the body's line, beside the closed row's effect.
  const line: ReactNode =
    !wide && control ? (
      <div className="su-play-act__line">
        {effect}
        {control}
      </div>
    ) : (
      effect
    )
  // What was chosen on it (R60): said when the row is open, and on a Passive
  // row always, which never opens.
  const chosen =
    picks.length > 0 && (open || entry.type === 'Passive') ? (
      <div className="su-play-act__picks">
        {picks.map((pick) => (
          <Stat
            key={`${pick.choice}-${pick.label}`}
            size="mini"
            label={playCopy('chosen')}
            value={pick.label}
          />
        ))}
      </div>
    ) : null
  const steps = open ? <PlayResolveSteps view={resolve} canWrite={canWrite} /> : null
  return (
    <li
      ref={rowRef}
      className="su-play-act"
      data-away={away || undefined}
      data-open={open || undefined}
      data-locked={(!away && locked !== null) || undefined}
      data-action-key={entry.key}
      data-done={done || undefined}
      // A Passive never opens: the list's keyboard stops at its name (r7 B8).
      data-passive={entry.type === 'Passive' || undefined}
    >
      {/* Mounted with the row, so the finish is spoken as the resolve closes. */}
      <span className="su-sr-only" role="status">
        {done ? doneSays : ''}
      </span>
      <Entity
        size="mini"
        context="play"
        model={titled}
        mode={OPENS_SOURCE}
        instance={entry.action.condition === 'destroyed' ? { condition: 'destroyed' } : undefined}
        tint={companion?.tone ?? entry.source}
        {...(companion
          ? { relations: [{ key: `companion-${companion.id}`, name: companion.name }] }
          : {})}
        dim={away || locked !== null || !canWrite}
        {...(away
          ? { state: <NeedChip need={NEED_TEXT[entry.need ?? 'boarded']} /> }
          : done
            ? { state: <Stat size="mini" label={playCopy('actionDone')} /> }
            : lockChip(locked, entry.action.condition))}
        {...(wide && control ? { controls: control } : {})}
        // Open, the Mini prints the whole effect (its model's prose), then
        // the steps; closed, the short line alone.
        body={{
          text: open,
          children: (
            <>
              {line}
              {chosen}
              {steps}
            </>
          ),
        }}
      />
    </li>
  )
}
