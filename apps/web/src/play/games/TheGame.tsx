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
 * focus on Cancel, which says what goes across and what stays: a Mediator's
 * notes are their own and never pass with the role (ADR-067 §4). With nobody mediating yet it reads **Appoint**, and a
 * solo Organizer may appoint themselves.
 *
 * Game settings (rename, describe), Remove and Leave are `GameSettings`'s
 * dialogs (ADR-067 §3), opened from here. The Discord channel line and
 * Archive are not here: the first is not built yet, and what archiving a
 * Game should mean is the owner's decision.
 */

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { ConfirmDialog } from '../../components/app'
import {
  Button,
  capsLabel,
  Field,
  HeaderMenu,
  Select,
  SlabSection,
  Stat,
  tokens,
} from '../../components/index'
import { cn } from '../../lib/cn'
import { failureMessage } from '../../lib/connection/useServerAction'
import { playGamesCopy } from '../../messages/play-games'
import { useGameListing } from '../../replica/gameListing'
import { useGamesCall } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'
import { CREWMATE, useTableRead } from '../../replica/useTable'
import { GameSettingsDialog, LeaveGameDialog } from './GameSettings'
import { HUB_BODY } from './hubStyles.model'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

const { space } = tokens

/** Why Hand over rests, said under the roles. */
const REASON = {
  color: tokens.color.ink2,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  margin: 0,
} satisfies CSSProperties

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
export function TheGame({
  gameId,
  viewerId,
  organizer,
  game,
  onDelete,
  onLeft,
}: {
  gameId: string
  /** The Game's name and description, for its settings. */
  game: { name: string; description?: string | null }
  /** After the viewer has left the Game. */
  onLeft: () => void
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
  const [settings, setSettings] = useState(false)
  // Who is going: the viewer (Leave) or a member the Organiser removes.
  const [going, setGoing] = useState<{ userId: string; name: string } | null>(null)

  // The viewer is "You" when their account has no name (never "Crewmate (you)").
  const name = (m: { userId: string; displayName: string }) =>
    m.userId !== viewerId
      ? m.displayName
      : m.displayName === CREWMATE
        ? playGamesCopy('you')
        : playGamesCopy('nameYou', { name: m.displayName })
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
                    id: 'settings',
                    label: playGamesCopy('gameSettingsMenu'),
                    onSelect: canWrite ? () => setSettings(true) : undefined,
                  },
                ],
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
        ) : (
          <HeaderMenu
            variant="overflow"
            size="compact"
            trigger={null}
            label={playGamesCopy('moreForTheGame')}
            sections={[
              [
                {
                  id: 'leave',
                  label: playGamesCopy('leaveThisGame'),
                  tone: 'danger',
                  onSelect:
                    canWrite && viewerId !== null
                      ? () => setGoing({ userId: viewerId, name: playGamesCopy('you') })
                      : undefined,
                },
              ],
            ]}
          />
        )
      }
    >
      {appointing && (
        <Stat
          label={playGamesCopy('mediator')}
          value={playGamesCopy('nobodyYet')}
          size="mini"
          wrap
        />
      )}
      {/* Why Hand over rests: there is nobody else at the table to take it. */}
      {organizer && members !== undefined && candidates.length === 0 && (
        <p style={REASON}>{playGamesCopy('nobodyToHandOverTo')}</p>
      )}
      {/* The table's people as rows — the
          name, what they run, and the pilot they hold — not painted Minis. */}
      <ul aria-label={playGamesCopy('members')} data-names-whole="" style={LINES}>
        {members?.map((m) => (
          <li key={m.userId} className="su-game-member">
            <span className="su-game-member__name">{name(m)}</span>
            <span className="su-game-member__marks">
              {m.mediator && <Stat label={playGamesCopy('mediator')} size="mini" />}
              {m.organizer && <Stat label={playGamesCopy('organiser')} size="mini" />}
            </span>
            {pilotsOf(m.userId).length > 0 && (
              <span className={cn('su-game-member__pilots', CAPS)}>
                {pilotsOf(m.userId)
                  .map((pilot) => pilot.name)
                  .join(' · ')}
              </span>
            )}
            {organizer && !m.organizer && (
              <span className="su-game-member__marks">
                <Button
                  variant="ghost"
                  size="mini"
                  disabled={!canWrite}
                  aria-label={playGamesCopy('removeMember', { name: m.displayName })}
                  onClick={() => setGoing({ userId: m.userId, name: m.displayName })}
                >
                  {playGamesCopy('remove')}
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <GameSettingsDialog
        key={String(settings)}
        gameId={gameId}
        name={game.name}
        description={game.description ?? null}
        open={settings}
        onOpenChange={setSettings}
      />
      <LeaveGameDialog
        gameId={gameId}
        gameName={game.name}
        member={going}
        self={going !== null && going.userId === viewerId}
        onClose={() => setGoing(null)}
        onLeft={onLeft}
      />
      <ConfirmDialog
        open={handing}
        onOpenChange={setHanding}
        tone="danger"
        title={appointing ? playGamesCopy('appointTheMediator') : playGamesCopy('handTheTableOver')}
        body={
          <>
            <span>
              {playGamesCopy('theMediatorRunsTheTable')}
              {appointing ? '' : playGamesCopy('whoeverMediatesNowStandsDown')}
            </span>
            {/* What moves with the role and what never does (r2 B3). */}
            <span>{playGamesCopy('handOverGoes')}</span>
            <span>{playGamesCopy('handOverStays')}</span>
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
        describeError={(err) => failureMessage(err, playGamesCopy('tableHandOverFailed'))}
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
