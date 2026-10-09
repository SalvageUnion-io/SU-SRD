/**
 * The Mediator's instruments — the layer ADR-021 deferred and ADR-030 §6
 * specifies — as the last section of the hub when a Game is showing.
 *
 * They used to be a page of their own (`/mediator/:id`), which opened with the
 * crew roster and put these underneath it. The hub already opens with that
 * roster, so the instruments are now simply what the Mediator finds below it:
 * the crew's numbers, a change to propose, a word to the table, and the
 * opposition. The table first, the apparatus second — the same claim the page
 * made, without a second page to make it on.
 *
 * ## Only the Mediator sees any of it
 *
 * `MediatorSection` renders nothing until `mediator.amMediator` answers true:
 * not a disabled form, not a placeholder. The server refuses every one of these
 * queries and mutations to anybody else, so drawing them for a player would be
 * offering controls that only ever error — and the opposition tray is private
 * by design.
 *
 * ## Deliberately not the player Dashboard
 *
 * The player Dashboard is a locked 1280×800 canvas built around one
 * pilot + mech + crawler (ADR-038 §9). An N-player table view does not fit it, so
 * this stays a plain scrolling section that grows with the crew.
 */

import { Button, Field, Input, Row, Select, Text, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { CrewVitals } from './CrewVitals'
import { GamePanel, GameSection } from './GamePanel'

/**
 * The live-play fields a Mediator may propose a change to.
 *
 * **These are Zod field names and the casing is load-bearing.** They read
 * `currentHp` / `currentAp` / `currentSp` before, none of which exist on
 * `PilotSchema` or `MechSchema` — so a proposal applied cleanly, wrote a key
 * nothing reads, and moved no number on the player's sheet. `proposals.apply`
 * now parses the merged body and refuses a field the schema has no room for,
 * which turns that class of typo into an error instead of a silent no-op.
 */
const PROPOSABLE_FIELDS = ['currentHP', 'currentAP', 'currentSP', 'currentHeat'] as const

/** Fields and their button on one line, wrapping on a phone. */
const FORM_ROW = {
  alignItems: 'flex-end',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  paddingTop: tokens.space[8],
} satisfies CSSProperties

const field = (minWidth: string) =>
  ({ flex: `1 1 ${minWidth}`, minWidth: 0 }) satisfies CSSProperties

function NpcTray({ gameId }: { gameId: Id<'games'> }) {
  const npcs = useQuery(api.mediator.npcs, { gameId })
  const addNpc = useMutation(api.mediator.addNpc)
  const removeNpc = useMutation(api.mediator.removeNpc)
  const [name, setName] = useState('')

  return (
    <GamePanel title="Opposition">
      <Text variant="hint">Only you can see this. Players never read the tray.</Text>

      {npcs?.map((n) => (
        <Row
          key={n._id}
          name={String((n.body as { name?: string })?.name ?? 'Unnamed')}
          actions={
            <Button variant="ghost" size="mini" onClick={() => void removeNpc({ npcId: n._id })}>
              Remove
            </Button>
          }
        />
      ))}

      <div style={FORM_ROW}>
        <div style={field('10rem')}>
          <Field label="Add">
            <Input aria-label="NPC name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Button
          variant="primary"
          size="compact"
          disabled={name.trim().length === 0}
          onClick={() => void addNpc({ gameId, body: { name } }).then(() => setName(''))}
        >
          Add
        </Button>
      </div>
    </GamePanel>
  )
}

function ProposeForm({ gameId }: { gameId: Id<'games'> }) {
  const crew = useQuery(api.crew.vitals, { gameId })
  const propose = useMutation(api.proposals.propose)

  const [target, setTarget] = useState('')
  const [fieldName, setFieldName] = useState<string>(PROPOSABLE_FIELDS[0])
  const [value, setValue] = useState('')

  // Only claimed entities can be proposed to — an unclaimed pre-gen has nobody
  // to answer, so offering it here would build a dead end into the UI.
  const targets = [
    ...(crew?.pilots ?? [])
      .filter((p) => p.ownerId !== null)
      .map((p) => ({ id: p._id, label: `${p.name} (pilot)`, type: 'pilot' as const })),
    ...(crew?.mechs ?? [])
      .filter((m) => m.ownerId !== null)
      .map((m) => ({ id: m._id, label: `${m.name} (mech)`, type: 'mech' as const })),
  ]
  const chosen = targets.find((t) => t.id === target)

  return (
    <GamePanel title="Propose a change">
      <Text variant="hint">
        You are asking, not setting. The player sees the before and after, and applies or declines
        it.
      </Text>

      <div style={FORM_ROW}>
        <div style={field('12rem')}>
          <Field label="To">
            <Select
              aria-label="Proposal target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Choose…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div style={field('10rem')}>
          <Field label="Field">
            <Select
              aria-label="Proposal field"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
            >
              {PROPOSABLE_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div style={field('8rem')}>
          <Field label="New value">
            <Input
              aria-label="Proposed value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        </div>

        <Button
          variant="primary"
          size="compact"
          disabled={chosen === undefined || value.trim().length === 0}
          onClick={() => {
            if (chosen === undefined) return
            void propose({
              entityId: chosen.id,
              entityType: chosen.type,
              field: fieldName,
              after: Number(value),
            }).then(() => setValue(''))
          }}
        >
          Propose
        </Button>
      </div>
    </GamePanel>
  )
}

function AlertBar({ gameId }: { gameId: Id<'games'> }) {
  const broadcast = useMutation(api.proposals.broadcast)
  const alerts = useQuery(api.proposals.alerts, { gameId, limit: 5 })
  const [message, setMessage] = useState('')

  return (
    <GamePanel title="Tell the table">
      <div style={FORM_ROW}>
        <div style={field('12rem')}>
          <Field label="Alert">
            <Input
              aria-label="Alert message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
        </div>
        <Button
          variant="primary"
          size="compact"
          disabled={message.trim().length === 0}
          onClick={() => void broadcast({ gameId, message }).then(() => setMessage(''))}
        >
          Send
        </Button>
      </div>
      {alerts?.map((a) => (
        <Row key={a._id} name={a.message} />
      ))}
    </GamePanel>
  )
}

/**
 * The hub's Mediator section: Vitals, Propose, Tell the table, Opposition.
 * Nothing at all for anyone who does not mediate this Game — see the header.
 */
export function MediatorSection({ gameId }: { gameId: Id<'games'> }) {
  const amMediator = useQuery(api.mediator.amMediator, { gameId })
  if (amMediator !== true) return null

  return (
    <GameSection
      id="mediator-section-heading"
      title="Mediator"
      hint="Only the Mediator sees this section."
    >
      {/* The numbers, live. The roster above answers "who has what"; this is
          the same crew read as one strip, which is how you scan a table
          mid-fight. */}
      <GamePanel title="Vitals">
        <CrewVitals gameId={gameId} />
      </GamePanel>
      <ProposeForm gameId={gameId} />
      <AlertBar gameId={gameId} />
      <NpcTray gameId={gameId} />
    </GameSection>
  )
}
