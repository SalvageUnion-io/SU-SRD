/**
 * TheGame — "The Game" on a Game's own page (board M2;
 * docs/architecture/play.md §16): who mediates, who organises,
 * and, for the Organizer, **Hand over** and **Delete this Game**: a chip and
 * the ⋯ menu on the section's head, as every contextual action is.
 *
 * Appointing the Mediator is the Organizer's (`games.setMediator`,
 * `requireOrganizer`), and it is the only way the flag is set: `games.create`
 * seats its creator with `mediator: false`. Hand over appoints the member you
 * choose, then stands down whoever mediated before, behind a confirm with
 * focus on Cancel. With nobody mediating yet it reads **Appoint**, and a
 * solo Organizer may appoint themselves.
 *
 * Rename, the Discord channel line and Archive are not here: the first two are
 * not built yet, and what archiving a Game should mean is the owner's decision.
 */

import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  Button,
  ConfirmDialog,
  Field,
  HeaderMenu,
  Select,
  SlabSection,
  Stat,
  tokens,
} from '../../components/index'
import { useConnection } from '../../lib/connection/connectionContext'
import { failureMessage } from '../../lib/connection/useServerAction'
import { HUB_BODY } from './hubStyles.model'

const { space } = tokens

/** Who mediates and who organises, a line each. */
const LINES = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties

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
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="the-game-heading"
      title="The Game"
      actions={
        organizer ? (
          <>
            <Button
              size="compact"
              disabled={!canWrite || candidates.length === 0}
              onClick={() => {
                setChosen(candidates[0]?.userId ?? '')
                setHanding(true)
              }}
            >
              {appointing ? 'Appoint' : 'Hand over'}
            </Button>
            <HeaderMenu
              variant="overflow"
              size="compact"
              trigger={null}
              label="More for The Game"
              sections={[
                [
                  {
                    id: 'delete',
                    label: 'Delete this Game…',
                    tone: 'danger',
                    onSelect: canWrite ? onDelete : undefined,
                  },
                ],
              ]}
            />
          </>
        ) : undefined
      }
    >
      {/* Each a Stat with a text value (ruleset §3.7, §6.2). */}
      <div style={LINES}>
        <Stat
          label="Mediator"
          value={mediators.length === 0 ? 'Nobody yet' : mediators.map(name).join(', ')}
          size="compact"
          wrap
        />
        <Stat
          label="Organiser"
          value={organizers.map(name).join(', ') || '—'}
          size="compact"
          wrap
        />
      </div>
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
        describeError={(err) =>
          failureMessage(err, 'The table could not be handed over. Try again.')
        }
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
    </SlabSection>
  )
}
