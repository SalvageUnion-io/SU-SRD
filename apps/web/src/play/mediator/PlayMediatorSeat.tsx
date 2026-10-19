/**
 * PlayMediatorSeat — one seat at the Mediator's table (play.md §10, wireframe
 * pin 2): the pilot's Row, level 1 in the column, with a presence dot in its
 * head, the mech as a relation chip (C11), and in its body (level 2, plain content) the mount in words,
 * every live vital as a chip, and what they are doing now.
 *
 *  - **Attention** — something needs the Mediator (`crewLines()`'s verdict):
 *    a ring in the bad hue around the seat, the flagged vital ▲ and critical,
 *    and the problem in words, so colour is never the only signal.
 *  - **Away** — their seat has stopped beating: the presence dot goes out, and
 *    the line says where they were last seen.
 *  - **Downtime** — the line says whether they are done with the step.
 *
 * The Row is in select mode: a tap aims Propose at this pilot (see the
 * problem, propose the fix). Sheet ⤢ opens their sheet read-only over Play.
 */

import type { CSSProperties } from 'react'
import { Row } from '../../components/entity/forms/Row'
import { Button, relation, Stat, tokens } from '../../components/index'
import { unitRowModel } from '../../lib/units/unitModel'
import type { MediatorSeat } from './mediatorTable.model'

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

const CHIPS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[4],
} satisfies CSSProperties

const LINE = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  margin: 0,
} satisfies CSSProperties

const MUTED = { ...LINE, color: tokens.color.ink75 } satisfies CSSProperties

const PROBLEM = { ...LINE, fontWeight: tokens.weight.bold } satisfies CSSProperties

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
}

export function PlayMediatorSeat({
  seat,
  picked,
  onPick,
  onOpenSheet,
  stepLine,
}: PlayMediatorSeatProps) {
  const away = !seat.present
  return (
    <li
      className="su-play-seat"
      data-attention={seat.attention || undefined}
      data-away={away || undefined}
    >
      <Row
        model={unitRowModel({ kind: 'pilot', name: seat.name })}
        omit={['art']}
        mode={{
          kind: 'select',
          role: 'radio',
          selected: picked,
          onSelect: onPick,
          seal: 'Target',
          label: `${seat.label}. Aim Propose here`,
        }}
        slots={{
          // The mech they are aboard or have parked is a relation chip (C11), never a Token under the Row (R5).
          ...(seat.mech === null ? {} : { relations: [relation('mech', 'Mech', seat.mech.name)] }),
          extraLabels: (
            <span
              className="su-play-crew-dot"
              data-present={seat.present || undefined}
              role="img"
              aria-label={seat.present ? 'Here' : 'Away'}
            />
          ),
          controls: (
            // The chip group's last slot, at the strip's Size (C1a, R6). On
            // the seat's own radio, its hit area keeps the 24px floor a
            // target on a target needs (WCAG 2.5.8; `entity-forms.css`).
            <Button
              variant="ghost"
              size="mini"
              aria-label={`Open ${seat.name}’s sheet`}
              onClick={onOpenSheet}
            >
              Sheet ⤢
            </Button>
          ),
          leading: (
            <div style={BODY}>
              <SeatMount seat={seat} />
              <div style={CHIPS}>
                {seat.vitals.map((v) => (
                  <Stat
                    key={v.label}
                    orientation="horizontal"
                    size="compact"
                    label={v.attention ? `▲ ${v.label}` : v.label}
                    value={v.value ?? undefined}
                    state={v.attention ? 'critical' : undefined}
                  />
                ))}
              </div>
              <SeatLine seat={seat} stepLine={stepLine} />
            </div>
          ),
        }}
      />
    </li>
  )
}

/** The mount in words ("Boarded · Buzzard", "On foot"); the mech itself is the head's relation chip. */
function SeatMount({ seat }: { seat: MediatorSeat }) {
  return <p style={MUTED}>{seat.mount}</p>
}

/** What they are doing now: the step, the roll, the problem, or where they were last seen. */
function SeatLine({ seat, stepLine }: { seat: MediatorSeat; stepLine: string | null }) {
  if (!seat.present) {
    return <p style={MUTED}>Last seen {seat.mount}</p>
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
      <p role="status" style={stepLine === null ? LINE : MUTED}>
        {stepLine ?? seat.resolving ?? ''}
      </p>
    </>
  )
}
