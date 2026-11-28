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
 * notes are their own and never pass with the role (ADR-067 §4); choosing
 * yourself is taking the table back, and the dialog says what comes to you. With nobody mediating yet it reads **Appoint**, and a
 * solo Organizer may appoint themselves.
 *
 * Game settings (describe), Remove and Leave are `GameSettings`'s
 * dialogs (ADR-067 §3), opened from here. The Discord channel line and
 * Archive are not here: the first is not built yet, and what archiving a
 * Game should mean is the owner's decision.
 */

import { mayBindChannel } from 'game-domain/games/discord'
import { pilotCallsign, pilotLabelOf } from 'game-domain/pilotLabel'
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
  Text,
  toast,
  tokens,
} from '../../components/index'
import { cn } from '../../lib/cn'
import { failureMessage } from '../../lib/connection/useServerAction'
import { formatDay, todayDay } from '../../lib/formatDate'
import { playGamesCopy } from '../../messages/play-games'
import { useGameListing } from '../../replica/gameListing'
import { useGamesCall } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'
import { CREWMATE, useTableRead } from '../../replica/useTable'
import { standingDownOnPurpose } from '../tableNotices.model'
import { GameChannelRow } from './GameChannelRow'
import { GameSettingsDialog, LeaveGameDialog } from './GameSettings'
import { HUB_BODY } from './hubStyles.model'
import { heldByMember } from './leaving.model'

/** A pilot's body as far as naming one goes. */
type Named = { callsign?: unknown; name?: unknown }

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
  /** The Game's name and description, for its settings, and the days its table next meets. */
  game: {
    name: string
    description?: string | null
    sessionDays?: readonly string[]
    /** The pilots and mechs a template Game came with: they stay when their holder goes. */
    templateUnitIds?: readonly string[] | undefined
  }
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
      .filter((p) => p.ownerId === userId && pilotLabelOf(p.body as Named) !== null)
      // By callsign, as Crew names them (r7 C2, LG7-02).
      .map((p) => ({ id: p._id, name: pilotCallsign(p.body as Named) }))
  const setMediator = useGamesCall('games.setMediator')
  const { canWrite } = useSync()
  const [handing, setHanding] = useState(false)
  const [chosen, setChosen] = useState<string>('')
  const [settings, setSettings] = useState(false)
  // Who is going: the viewer (Leave) or a member the Organiser removes.
  const [going, setGoing] = useState<{ userId: string; name: string } | null>(null)

  // The viewer is "You" when their account has no name (never "Player 2 (you)").
  const name = (m: { userId: string; displayName: string; unnamed?: true }) =>
    m.userId !== viewerId
      ? m.displayName
      : m.unnamed
        ? playGamesCopy('you')
        : playGamesCopy('nameYou', { name: m.displayName })
  /** "Sam (Pumpkin)": a member and the Pilots they play. */
  const whoWithPilots = (m: { userId: string; displayName: string }) => {
    const pilots = pilotsOf(m.userId).map((pilot) => pilot.name)
    return pilots.length === 0
      ? m.displayName
      : playGamesCopy('nameAndPilots', { name: m.displayName, pilots: pilots.join(', ') })
  }
  const mediators = members?.filter((m) => m.mediator) ?? []
  const candidates = members?.filter((m) => !m.mediator) ?? []
  const appointing = mediators.length === 0
  // Taking the table oneself is not giving it away: the dialog says what comes, not what goes (MD4-17).
  const takingBack = chosen !== '' && chosen === viewerId
  // Somebody else mediates and the only one to give the table to is the viewer: the button says
  // that act (r5 B14). With others to choose from it stays Hand over, and the dialog says which.
  const canTakeBack = !appointing && candidates.length === 1 && candidates[0]?.userId === viewerId
  // The next day the table meets, by the viewer's own clock (the room answers from yesterday on).
  const today = todayDay()
  const nextSession = game.sessionDays?.find((day) => day >= today)

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
              {appointing
                ? playGamesCopy('appoint')
                : canTakeBack
                  ? playGamesCopy('takeBack')
                  : playGamesCopy('handOver')}
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
      {/* What the Game is and when it next meets, for every member (MD2-07). */}
      {game.description != null && game.description !== '' && <Text>{game.description}</Text>}
      {nextSession !== undefined && (
        <Stat
          label={playGamesCopy('nextSession')}
          value={formatDay(nextSession)}
          size="mini"
          wrap
        />
      )}
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
                  // The person and their Pilot, so the right friend goes (r7 C2, LG7-20).
                  onClick={() => setGoing({ userId: m.userId, name: whoWithPilots(m) })}
                >
                  {playGamesCopy('remove')}
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* Where its rolls post, and the way to bind one (MD-20). */}
      <GameChannelRow
        gameId={gameId}
        gameName={game.name}
        mayBind={mayBindChannel({
          mediator: members?.some((m) => m.userId === viewerId && m.mediator) ?? false,
          organizer,
        })}
      />
      <GameSettingsDialog
        key={String(settings)}
        gameId={gameId}
        description={game.description ?? null}
        open={settings}
        onOpenChange={setSettings}
      />
      <LeaveGameDialog
        gameId={gameId}
        gameName={game.name}
        member={going}
        self={going !== null && going.userId === viewerId}
        held={
          going === null ? undefined : heldByMember(listing, game.templateUnitIds, going.userId)
        }
        onClose={() => setGoing(null)}
        onLeft={onLeft}
      />
      <ConfirmDialog
        open={handing}
        onOpenChange={setHanding}
        tone="danger"
        title={
          appointing
            ? playGamesCopy('appointTheMediator')
            : takingBack
              ? playGamesCopy('takeTheTableBack')
              : playGamesCopy('handTheTableOver')
        }
        body={
          <>
            <span>
              {playGamesCopy('theMediatorRunsTheTable')}
              {appointing ? '' : playGamesCopy('whoeverMediatesNowStandsDown')}
            </span>
            {/* What moves with the role and what never does (r2 B3). */}
            <span>{playGamesCopy(takingBack ? 'takeBackComes' : 'handOverGoes')}</span>
            <span>{playGamesCopy(takingBack ? 'takeBackNotes' : 'handOverStays')}</span>
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
        confirmLabel={
          appointing
            ? playGamesCopy('appoint')
            : takingBack
              ? playGamesCopy('takeItBack')
              : playGamesCopy('handOver')
        }
        describeError={(err) => failureMessage(err, playGamesCopy('tableHandOverFailed'))}
        onConfirm={async () => {
          if (chosen === '') return
          // Standing down by this hand over is the Organiser's own doing: no notice of it.
          const mine = mediators.some((m) => m.userId === viewerId) && chosen !== viewerId
          const undo = mine ? standingDownOnPurpose(gameId) : null
          try {
            // Appoint first, so the table is never left without a Mediator.
            await setMediator({ gameId, userId: chosen, mediator: true })
            for (const m of mediators) {
              if (m.userId !== chosen)
                await setMediator({ gameId, userId: m.userId, mediator: false })
            }
          } catch (err) {
            undo?.()
            throw err
          }
          // It landed, said back to whoever did it (r3 A4).
          const to = candidates.find((m) => m.userId === chosen)
          toast.success(
            chosen === viewerId
              ? playGamesCopy('youMediateNow', { game: game.name })
              : playGamesCopy('handedOverTo', {
                  name: to === undefined ? CREWMATE : to.displayName,
                  game: game.name,
                })
          )
        }}
      />
    </SlabSection>
  )
}
