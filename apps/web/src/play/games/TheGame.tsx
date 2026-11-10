/**
 * TheGame — "The Game", the sidebar of a Game's own page
 * (docs/architecture/play.md §16): its people, each a small social card (R50):
 * a header-only Mini in Discord's colour, their name and chips for their
 * roles. What they hold rides the Crew list. And, for the Organizer, **Hand over** and **Delete this Game**: a chip and
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

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import type { EntityFormModel } from '../../components/index'
import {
  Button,
  ConfirmDialog,
  Entity,
  Field,
  HeaderMenu,
  relation,
  Select,
  SlabSection,
  Stat,
  tokens,
} from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { syntheticModel } from '../../lib/units/syntheticModel'
import { playGamesCopy } from '../../messages/play-games'
import { useGameListing } from '../../replica/gameListing'
import { useGamesCall } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'
import { useTableRead } from '../../replica/useTable'
import { HUB_BODY } from './hubStyles.model'

const { space } = tokens

/** The members' small cards, one a line. */
const LINES = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/** A member as an entity: their Discord name, in Discord's colour. */
function memberModel(name: string): EntityFormModel {
  return syntheticModel({
    schemaName: 'classes',
    id: `member/${name}`,
    slug: name,
    name,
    kind: { label: playGamesCopy('member'), domain: 'pilot' },
    tone: 'discord',
  })
}

export function TheGame({
  gameId,
  viewerId,
  organizer,
  onDelete,
}: {
  gameId: string
  viewerId: string | null
  /** The viewer organises this Game: Hand over and Delete are theirs. */
  organizer: boolean
  onDelete: () => void
}) {
  const id = useId()
  const members = useTableRead('games.members', { gameId })
  // Who plays whom: each member's pilots, a relation chip on their Mini (C11).
  const listing = useGameListing(gameId)
  const pilotsOf = (userId: string) =>
    (listing?.pilots ?? [])
      .filter((p) => p.ownerId === userId)
      .map((p) => ({ id: p._id, name: String((p.body as { name?: unknown }).name ?? '') }))
      .filter((p) => p.name !== '')
  const setMediator = useGamesCall('games.setMediator')
  const { canWrite } = useSync()
  const [handing, setHanding] = useState(false)
  const [chosen, setChosen] = useState<string>('')

  const name = (m: { userId: string; displayName: string }) =>
    m.userId === viewerId ? `${m.displayName} (you)` : m.displayName
  const mediators = members?.filter((m) => m.mediator) ?? []
  const candidates = members?.filter((m) => !m.mediator) ?? []
  const appointing = mediators.length === 0

  return (
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="the-game-heading"
      title={playGamesCopy('theGame')}
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
              {appointing ? playGamesCopy('appoint') : playGamesCopy('handOver')}
            </Button>
            <HeaderMenu
              variant="overflow"
              size="compact"
              trigger={null}
              label={playGamesCopy('moreForTheGame')}
              sections={[
                [
                  {
                    id: 'delete',
                    label: playGamesCopy('deleteThisGame'),
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
      {appointing && <Stat label={playGamesCopy('mediator')} value="Nobody yet" size="mini" wrap />}
      <ul aria-label={playGamesCopy('members')} data-names-whole="" style={LINES}>
        {members?.map((m) => (
          <li key={m.userId}>
            <Entity
              size="mini"
              context="roster"
              model={memberModel(name(m))}
              omit={['kind']}
              relations={pilotsOf(m.userId).map((pilot) =>
                relation(`pilot-${pilot.id}`, 'Pilot', pilot.name)
              )}
              state={
                m.mediator || m.organizer ? (
                  <>
                    {m.mediator && <Stat label={playGamesCopy('mediator')} size="mini" />}
                    {m.organizer && <Stat label={playGamesCopy('organiser')} size="mini" />}
                  </>
                ) : undefined
              }
            />
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={handing}
        onOpenChange={setHanding}
        tone="danger"
        title={appointing ? playGamesCopy('appointTheMediator') : playGamesCopy('handTheTableOver')}
        body={
          <>
            <span>
              The Mediator runs the table: the opposition, Downtime, the crawler, and proposals to
              the crew.
              {appointing ? '' : playGamesCopy('whoeverMediatesNowStandsDown')}
            </span>
            <Field label={playGamesCopy('whoMediates')} htmlFor={`${id}-who`}>
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
        confirmLabel={appointing ? playGamesCopy('appoint') : playGamesCopy('handOver')}
        describeError={(err) =>
          failureMessage(err, 'The table could not be handed over. Try again.')
        }
        onConfirm={async () => {
          if (chosen === '') return
          // Appoint first, so the table is never left without a Mediator.
          await setMediator({ gameId, userId: chosen, mediator: true })
          for (const m of mediators) {
            if (m.userId !== chosen)
              await setMediator({ gameId, userId: m.userId, mediator: false })
          }
        }}
      />
    </SlabSection>
  )
}
