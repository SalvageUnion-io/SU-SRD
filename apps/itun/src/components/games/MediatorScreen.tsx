import { useState } from 'react'
import { Button, Card, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { CrewVitals } from './CrewVitals'
import { DowntimePanel } from './DowntimePanel'
import { INPUT, ROW, SECTION, STAMP, TITLE } from './gameChrome'

/**
 * The Mediator surface — the layer ADR-021 deferred and ADR-030 §6 specifies.
 *
 * It is one screen because the Mediator's problem is holding four things at
 * once: what the crew's numbers are, what the opposition is, what they want to
 * change, and where the table is in a Downtime. Splitting those across routes
 * would recreate the tab-flipping this is meant to replace.
 *
 * ## Deliberately not the player Dashboard
 *
 * The player Dashboard is a locked 1280×800 canvas built around one
 * pilot + mech + crawler (ADR-020). An N-player table view does not fit it, and
 * stretching it to would reopen a layout that took ~60 iterations to settle.
 * This is a plain scrolling surface instead — the *right* shape for a list that
 * grows with the crew.
 *
 * ## Scope note
 *
 * The composition here is functional and uses the app's existing chrome
 * vocabulary (hard ink borders, stamped condensed caps, the shipped tracking
 * ladder). It has not had a design pass, and the visual arrangement is the part
 * most likely to change.
 */

const PROPOSABLE_FIELDS = ['currentHp', 'currentAp', 'currentSp', 'currentHeat'] as const

function NpcTray({ gameId }: { gameId: Id<'games'> }) {
  const npcs = useQuery(api.mediator.npcs, { gameId })
  const addNpc = useMutation(api.mediator.addNpc)
  const removeNpc = useMutation(api.mediator.removeNpc)
  const [name, setName] = useState('')

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <Text as="span" className={SECTION}>
          Opposition
        </Text>
        <Text variant="hint">Only you can see this. Players never read the tray.</Text>

        {npcs?.map((n) => (
          <div key={n._id} className={ROW}>
            <Text as="span">{String((n.body as { name?: string })?.name ?? 'Unnamed')}</Text>
            <Button variant="ghost" size="mini" onClick={() => void removeNpc({ npcId: n._id })}>
              Remove
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className={STAMP}>Add</span>
            <input
              aria-label="NPC name"
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button
            variant="primary"
            size="compact"
            disabled={name.trim().length === 0}
            onClick={() => void addNpc({ gameId, body: { name } }).then(() => setName(''))}
          >
            Add
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ProposeForm({ gameId }: { gameId: Id<'games'> }) {
  const crew = useQuery(api.crew.vitals, { gameId })
  const propose = useMutation(api.proposals.propose)

  const [target, setTarget] = useState('')
  const [field, setField] = useState<string>(PROPOSABLE_FIELDS[0])
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
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <Text as="span" className={SECTION}>
          Propose a change
        </Text>
        <Text variant="hint">
          You are asking, not setting. The player sees the before and after, and applies or declines
          it.
        </Text>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className={STAMP}>To</span>
            <select
              aria-label="Proposal target"
              className={INPUT}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Choose…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={STAMP}>Field</span>
            <select
              aria-label="Proposal field"
              className={INPUT}
              value={field}
              onChange={(e) => setField(e.target.value)}
            >
              {PROPOSABLE_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={STAMP}>New value</span>
            <input
              aria-label="Proposed value"
              className={INPUT}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>

          <Button
            variant="primary"
            size="compact"
            disabled={chosen === undefined || value.trim().length === 0}
            onClick={() => {
              if (chosen === undefined) return
              void propose({
                entityId: chosen.id,
                entityType: chosen.type,
                field,
                before: null,
                after: Number(value),
              }).then(() => setValue(''))
            }}
          >
            Propose
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AlertBar({ gameId }: { gameId: Id<'games'> }) {
  const broadcast = useMutation(api.proposals.broadcast)
  const alerts = useQuery(api.proposals.alerts, { gameId, limit: 5 })
  const [message, setMessage] = useState('')

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <Text as="span" className={SECTION}>
          Tell the table
        </Text>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className={STAMP}>Alert</span>
            <input
              aria-label="Alert message"
              className={INPUT}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
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
          <div key={a._id} className={ROW}>
            <Text as="span" variant="hint">
              {a.message}
            </Text>
          </div>
        ))}
      </div>
    </Card>
  )
}

function PresenceList({ gameId }: { gameId: Id<'games'> }) {
  const rows = useQuery(api.mediator.presence, { gameId })
  if (rows === undefined || rows.length === 0) return null

  return (
    <Card>
      <div className="flex flex-col gap-1 p-4">
        <Text as="span" className={SECTION}>
          At the table
        </Text>
        {rows.map((r) => (
          <div key={r.userId} className={ROW}>
            <Text as="span">{r.displayName}</Text>
            <Text as="span" variant="hint">
              {r.present ? 'here' : 'away'}
            </Text>
          </div>
        ))}
      </div>
    </Card>
  )
}

function MediatorBody({ gameId }: { gameId: Id<'games'> }) {
  const amMediator = useQuery(api.mediator.amMediator, { gameId })

  if (amMediator === undefined) return <Text>Loading…</Text>
  if (!amMediator) {
    return (
      <Card>
        <div className="p-4">
          <Text>You do not mediate this game. Ask whoever organises it to hand you the role.</Text>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="p-4">
          <CrewVitals gameId={gameId} />
        </div>
      </Card>
      <PresenceList gameId={gameId} />
      <ProposeForm gameId={gameId} />
      <AlertBar gameId={gameId} />
      <DowntimePanel gameId={gameId} />
      <NpcTray gameId={gameId} />
    </div>
  )
}

export function MediatorScreen({ gameId }: { gameId: string }) {
  const { mode } = useConnection()

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
      <Text as="h1" className={TITLE}>
        Mediator
      </Text>
      {!isConvexConfigured || mode !== 'connected' ? (
        <Card>
          <div className="p-4">
            <Text>
              Running a table needs a connected account. This build is playing solo, so there is no
              game to mediate.
            </Text>
          </div>
        </Card>
      ) : (
        <MediatorBody gameId={gameId as Id<'games'>} />
      )}
    </main>
  )
}
