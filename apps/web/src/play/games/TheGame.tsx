/**
 * TheGame — "The Game" on a Game's own page (board M2;
 * docs/architecture/play.md §16): its people, each a social card (owner,
 * round 4: "social cards, compact contentful, for each user"): a contentful
 * Compact in Discord's colour, their Discord picture and name, chips for
 * their roles, and the pilots and mechs they hold in this Game as header-only
 * Minis linking to them. And, for the Organizer, **Hand over** and **Delete this Game**: a chip and
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
import type { EntityFormModel, LinkedUnit } from '../../components/index'
import {
  Button,
  ConfirmDialog,
  Entity,
  Field,
  HeaderMenu,
  Select,
  SlabSection,
  Stat,
  tokens,
} from '../../components/index'
import { useConnection } from '../../lib/connection/connectionContext'
import { failureMessage } from '../../lib/connection/useServerAction'
import { ownableRows, rosterSheetHref } from '../../lib/games/gameRoster'
import { HUB_BODY } from './hubStyles.model'

const { space } = tokens

/** The members' cards, one a line. */
const LINES = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/** A member as an entity: their Discord name and picture, in Discord's colour. */
function memberModel(name: string, avatarUrl: string | undefined): EntityFormModel {
  return {
    ref: { schemaName: 'classes', id: `member/${name}`, slug: name, name, synthetic: true },
    title: name,
    kind: { stamp: 'Member', type: 'Member', domain: 'pilot', nature: 'have' },
    tone: 'discord',
    facts: [],
    traits: [],
    art: avatarUrl ? { kind: 'image', url: avatarUrl } : { kind: 'none' },
  }
}

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
  const listing = useQuery(api.entities.listForGame, { gameId })
  const setMediator = useMutation(api.games.setMediator)
  const { canWrite } = useConnection()
  const [handing, setHanding] = useState(false)
  const [chosen, setChosen] = useState<string>('')

  const name = (m: { userId: string; displayName: string }) =>
    m.userId === viewerId ? `${m.displayName} (you)` : m.displayName
  const mediators = members?.filter((m) => m.mediator) ?? []
  const candidates = members?.filter((m) => !m.mediator) ?? []
  const appointing = mediators.length === 0

  // What each member holds here, by their id: their pilots, then their mechs.
  const held = new Map<string, LinkedUnit[]>()
  for (const kind of ['pilot', 'mech'] as const) {
    const rows = ownableRows({
      kind,
      rows: (kind === 'pilot' ? listing?.pilots : listing?.mechs) ?? [],
      viewerId,
      members: members ?? [],
      localIds: new Set(),
    })
    for (const row of rows) {
      if (row.ownerId === null) continue
      const list = held.get(row.ownerId) ?? []
      list.push({ key: row.serverId, kind, name: row.name, href: rosterSheetHref(row) })
      held.set(row.ownerId, list)
    }
  }

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
      {appointing && <Stat label="Mediator" value="Nobody yet" size="compact" wrap />}
      <ul aria-label="Members" className="su-game-members" style={LINES}>
        {members?.map((m) => (
          <li key={m.userId}>
            <Entity
              size="compact"
              context="roster"
              model={memberModel(name(m), m.avatarUrl)}
              omit={['kind']}
              labels={
                m.mediator || m.organizer ? (
                  <>
                    {m.mediator && <Stat label="Mediator" size="compact" />}
                    {m.organizer && <Stat label="Organiser" size="compact" />}
                  </>
                ) : undefined
              }
              {...(held.get(m.userId)?.length ? { linked: held.get(m.userId) } : {})}
            />
          </li>
        ))}
      </ul>
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
