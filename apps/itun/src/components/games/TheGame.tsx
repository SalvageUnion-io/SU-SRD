/**
 * TheGame — "The Game" on a Game's own page (board M2;
 * docs/architecture/mediator-dashboard.md Q13): who mediates, who organises,
 * and, for the Organizer, **Hand over** and **Delete this game**.
 *
 * Appointing the Mediator is the Organizer's (`games.setMediator`,
 * `requireOrganizer`), and it is the only way the flag is set: `games.create`
 * seats its creator with `mediator: false`. Hand over appoints the member you
 * choose, then stands down whoever mediated before, behind a confirm with
 * focus on Cancel. With nobody mediating yet it reads **Appoint**, and a
 * solo Organizer may appoint themselves.
 *
 * Rename, the Discord channel line and Archive are not here: the first two are
 * P8b, and what archiving a Game should mean is the owner's decision.
 */

import { Button, ConfirmDialog, Field, Select, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { HubSection } from './HubSection'

const { color, font, fontSize, space, tracking, weight } = tokens

const LIST: CSSProperties = {
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[10],
}

const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '7rem minmax(0, 1fr)',
  alignItems: 'center',
  gap: space[12],
}

const VALUE_ROW: CSSProperties = {
  margin: 0,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[8],
}

const TERM: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink,
}

const VALUE: CSSProperties = {
  margin: 0,
  minWidth: 0,
  overflowWrap: 'anywhere',
  fontFamily: font.body,
  fontSize: fontSize.lede,
  color: color.ink,
}

const NONE: CSSProperties = { ...VALUE, color: color.wkMuted }

const ACTIONS: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: space[8] }

export function TheGame({
  gameId,
  viewerId,
  organizer,
  onDelete,
}: {
  gameId: Id<'games'>
  viewerId: string | null
  /** The viewer organises this Game: Hand over and Delete are theirs. */
  organizer: boolean
  onDelete: () => void
}) {
  const id = useId()
  const members = useQuery(api.games.members, { gameId })
  const setMediator = useMutation(api.games.setMediator)
  const { canWrite } = useConnection()
  const [handing, setHanding] = useState(false)
  const [chosen, setChosen] = useState<string>('')

  const name = (m: { userId: string; displayName: string }) =>
    m.userId === viewerId ? `${m.displayName} (you)` : m.displayName
  const mediators = members?.filter((m) => m.mediator) ?? []
  const organizers = members?.filter((m) => m.organizer) ?? []
  const candidates = members?.filter((m) => !m.mediator) ?? []
  const appointing = mediators.length === 0

  return (
    <HubSection id="the-game-heading" title="The Game">
      <dl style={LIST}>
        <div style={ROW}>
          <dt style={TERM}>Mediator</dt>
          <dd style={VALUE_ROW}>
            <span style={mediators.length === 0 ? NONE : VALUE}>
              {mediators.length === 0 ? 'Nobody yet' : mediators.map(name).join(', ')}
            </span>
            {organizer && (
              <Button
                variant="default"
                size="compact"
                disabled={!canWrite || candidates.length === 0}
                onClick={() => {
                  setChosen(candidates[0]?.userId ?? '')
                  setHanding(true)
                }}
              >
                {appointing ? 'Appoint' : 'Hand over'}
              </Button>
            )}
          </dd>
        </div>
        <div style={ROW}>
          <dt style={TERM}>Organizer</dt>
          <dd style={VALUE}>{organizers.map(name).join(', ') || '—'}</dd>
        </div>
      </dl>
      {organizer && (
        <div style={ACTIONS}>
          <Button variant="danger" size="compact" disabled={!canWrite} onClick={onDelete}>
            Delete this game
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={handing}
        onOpenChange={setHanding}
        tone="danger"
        title={appointing ? 'Appoint the Mediator' : 'Hand the table over?'}
        body={
          <>
            <span>
              The Mediator runs the table: the opposition, Downtime, the crawler, and proposals to
              the crew.
              {appointing ? '' : ' Whoever mediates now stands down.'}
            </span>
            <Field label="Who mediates" htmlFor={`${id}-who`}>
              <Select id={`${id}-who`} value={chosen} onChange={(e) => setChosen(e.target.value)}>
                {candidates.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {name(m)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        }
        confirmLabel={appointing ? 'Appoint' : 'Hand over'}
        onConfirm={async () => {
          if (chosen === '') return
          // Appoint first, so the table is never left without a Mediator.
          await setMediator({ gameId, userId: chosen as Id<'users'>, mediator: true })
          for (const m of mediators) {
            if (m.userId !== chosen)
              await setMediator({ gameId, userId: m.userId, mediator: false })
          }
        }}
      />
    </HubSection>
  )
}
