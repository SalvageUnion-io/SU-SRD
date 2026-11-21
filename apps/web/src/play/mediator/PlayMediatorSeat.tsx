/**
 * PlayMediatorSeat — one seat at the Mediator's table (play.md §10): the pilot's Mini, one a line (ruleset §1.3: Play's lists are
 * Minis), its chips what the table needs at a glance: the mech as a relation
 * chip (C11), whether they are here ("Here", or "Away" once their seat
 * stops beating) and the vital needing the Mediator (▲, critical). Its body
 * (N3, plain content, no entity) is the mount in words, every live vital as a
 * chip, and what they are doing now.
 *
 *  - **Attention** — something needs the Mediator (`crewLines()`'s verdict):
 *    a ring in the bad hue around the seat, the flagged vital ▲ and critical,
 *    and the problem in words, so colour is never the only signal.
 *  - **Away** — their seat has stopped beating: the line says where they
 *    were last seen.
 *  - **Downtime** — the line says whether they are done with the step.
 *
 * The Mini is a toggle (EDL Modes): pressed, its name aims Propose at this
 * pilot (see the problem, propose the fix), the ring on its pill; the other
 * seats stay at full strength, since their vitals are still being read. Sheet, its chip group's last slot, opens their
 * sheet read-only over Play; Up now beside it marks whose turn it is, for
 * every seat to read (a marker only: nothing is enforced).
 */

import type { CSSProperties } from 'react'
import { Button, Entity, Stat, Toggle, tokens } from '../../components/index'
import { crewPair } from '../../lib/units/crewPair'
import { unitRowModel } from '../../lib/units/unitModel'
import { mediatorCopy } from '../../messages/play-mediator'
import { NOTE, NOTE_MUTED } from './mediatorStyles.model'
import type { MediatorSeat } from './mediatorTable.model'

const CHIPS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[4],
} satisfies CSSProperties

const PROBLEM = { ...NOTE, fontWeight: tokens.weight.bold } satisfies CSSProperties

/** The ▲ is the one mark in the bad hue; the words stay ink. */
const MARK = { color: tokens.color.statusBad } satisfies CSSProperties

type PlayMediatorSeatProps = {
  seat: MediatorSeat
  /** Propose is aimed at this seat's pilot. */
  picked: boolean
  onPick: () => void
  onOpenSheet: () => void
  /** While Downtime runs: this seat's step line ("Step 3 · done ✓"). */
  stepLine: string | null
  /** The Mediator marked this pilot as up now. */
  upNow: boolean
  /** Mark, or unmark, this pilot as up now; absent while Play is read-only. */
  onUpNow?: () => void
}

export function PlayMediatorSeat({
  seat,
  picked,
  onPick,
  onOpenSheet,
  stepLine,
  upNow,
  onUpNow,
}: PlayMediatorSeatProps) {
  const away = !seat.present
  const flagged = seat.vitals.find((v) => v.attention)
  // Aboard, the seat wears their mech's tone and readings and keeps their
  // name, with a MECH chip; on foot the pilot's, with the same chip (`crewPair`).
  const pair = crewPair({
    pilot: { id: seat.pilotId, name: seat.name },
    mech: seat.mech,
    boarded: seat.mech?.boarded ?? false,
  })
  // The toggle's name opens on what it shows (WCAG 2.5.3): "Bonesaw (Pilot)",
  // aboard or on foot, then the seat's reading.
  const shown = mediatorCopy('seatShown', { name: pair.name, kind: 'Pilot' })
  const reading = seat.label.startsWith(`${seat.name}, `)
    ? seat.label.slice(seat.name.length + 2)
    : seat.label
  return (
    <li
      className="su-play-seat"
      data-attention={seat.attention || undefined}
      data-away={away || undefined}
      data-choice-toggle=""
    >
      <Entity
        size="mini"
        context="roster"
        model={unitRowModel({ kind: pair.kind, name: pair.name })}
        mode={{
          kind: 'select',
          role: 'toggle',
          selected: picked,
          onSelect: onPick,
          label: mediatorCopy('aimProposeHere', { label: `${shown}, ${reading}` }),
        }}
        {...(pair.relations ? { relations: [...pair.relations] } : {})}
        state={
          <>
            <Stat size="mini" label={away ? mediatorCopy('away') : mediatorCopy('here')} />
            {flagged ? (
              <Stat
                size="mini"
                state="critical"
                label={`▲ ${flagged.label}`}
                value={flagged.value ?? undefined}
              />
            ) : null}
          </>
        }
        controls={
          // The chip group's last slots, at the strip's Size (C1a, C8).
          <>
            {onUpNow ? (
              <Toggle
                size="mini"
                pressed={upNow}
                aria-label={mediatorCopy('upNowFor', { name: seat.name })}
                onClick={onUpNow}
              >
                {mediatorCopy('upNow')}
              </Toggle>
            ) : upNow ? (
              <Stat size="mini" label={mediatorCopy('upNow')} />
            ) : null}
            <Button
              variant="ghost"
              size="mini"
              aria-label={mediatorCopy('openSSheet', { name: seat.name })}
              onClick={onOpenSheet}
            >
              {mediatorCopy('sheet')}
            </Button>
          </>
        }
        body={{
          text: false,
          children: (
            <>
              <SeatMount seat={seat} />
              <div style={CHIPS}>
                {seat.vitals.map((v) => (
                  <Stat
                    key={v.label}
                    size="mini"
                    label={v.attention ? `▲ ${v.label}` : v.label}
                    value={v.value ?? undefined}
                    state={v.attention ? 'critical' : undefined}
                  />
                ))}
              </div>
              <SeatLine seat={seat} stepLine={stepLine} />
            </>
          ),
        }}
      />
    </li>
  )
}

/** The mount in words ("Boarded · Buzzard", "On foot"); the mech itself is the head's relation chip. */
function SeatMount({ seat }: { seat: MediatorSeat }) {
  return <p style={NOTE_MUTED}>{seat.mount}</p>
}

/** What they are doing now: the step, the roll, the problem, or where they were last seen. */
function SeatLine({ seat, stepLine }: { seat: MediatorSeat; stepLine: string | null }) {
  if (!seat.present) {
    return <p style={NOTE_MUTED}>{mediatorCopy('lastSeen', { mount: seat.mount })}</p>
  }
  return (
    <>
      {seat.problem !== null && (
        <p style={PROBLEM}>
          <span style={MARK} aria-hidden="true">
            ▲{' '}
          </span>
          {seat.problem}
        </p>
      )}
      <p role="status" style={stepLine === null ? NOTE : NOTE_MUTED}>
        {stepLine ?? seat.resolving ?? ''}
      </p>
    </>
  )
}
