/**
 * PlayLanding — where the Union bar's Play tab lands (`/play/`): one tap from
 * here into any Game or solo pilot.
 *
 *  - **Your Games** (`games.listMine`): each Game you are in, as the
 *    play-entry wireframe draws it: how many are here now ("3 here", the
 *    seats' heartbeats, `seats.presence`, play.md §7), a MEDIATOR stamp where
 *    you mediate it, a Downtime chip while it is in Downtime
 *    (`downtime.state`), your pilots in it, then Mediate where you mediate it
 *    and Play for each of your pilots in it.
 *  - **Solo**: each pilot on your shelf, with its mech's chip or "No Mech",
 *    and Play solo.
 *  - **Discord**: the channels play posts to (`PlayDiscordSection`).
 *
 * Signed out there is nothing to play, so it asks you to sign in. The store
 * holds only your own pilots, so every pilot it lists is yours to play.
 * Disconnected, the shelf's pilots still list from the store; the Game list
 * waits for the connection.
 */

import '../styles/play/play.css'
import { isPresent } from 'cantina-domain/schemas/seat'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { CSSProperties } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Shelf } from '../build/shelves/Shelf'
import {
  Badge,
  buttonVariants,
  Card,
  ChapterBand,
  Cluster,
  PageShell,
  Pending,
  Text,
  tokens,
} from '../components/index'
import { AppLink } from '../components/shared/AppLink'
import { UnitRow } from '../components/shared/UnitRow'
import { useConnection } from '../lib/connection/connectionContext'
import { useHydrateEntities, useMechs, usePilots, useSoftLinkList } from '../lib/entities'
import { PlayDiscordSection } from './PlayDiscordSection'
import { PlayPending, PlayRefusal } from './PlayRefusal'
import { gamePilots, soloPilots } from './play.model'
import { usePresenceClock } from './usePresenceClock'

type GameSummary = FunctionReturnType<typeof api.games.listMine>[number]

const ITEM = { listStyle: 'none', minWidth: 0 } satisfies CSSProperties

const GAME = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
  justifyContent: 'space-between',
} satisfies CSSProperties

const GAME_NAME = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.readout,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsTight,
  margin: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

const LINK = { textDecoration: 'none' } satisfies CSSProperties

const SECTIONS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
} satisfies CSSProperties

const PLAY = buttonVariants({ variant: 'primary', size: 'compact' })

const MEDIATE = buttonVariants({ variant: 'default', size: 'compact' })

export function PlayLanding() {
  const { mode } = useConnection()
  if (mode === 'solo') {
    return (
      <PlayRefusal
        title="Sign in to play"
        body="Play runs your Pilots, solo or in a Game. Sign in to open them."
        link={{ href: '/sign-in', label: 'Sign in with Discord' }}
      />
    )
  }
  if (mode === 'connecting') return <PlayPending label="your session" />
  if (mode === 'connected') return <ConnectedPlayLanding />
  return <PlayLandingView games={undefined} />
}

function ConnectedPlayLanding() {
  const games = useQuery(api.games.listMine, {})
  return <PlayLandingView games={games} connected />
}

type PlayLandingViewProps = {
  /** Your Games; undefined while they load, or with no server to ask. */
  games: readonly GameSummary[] | undefined
  /** There is a server to ask: an unanswered list is loading, not waiting. */
  connected?: boolean
}

function PlayLandingView({ games, connected = false }: PlayLandingViewProps) {
  useHydrateEntities(['pilot', 'mech', 'softLink'])
  const pilots = usePilots()
  const solo = soloPilots(pilots, useMechs(), useSoftLinkList())

  return (
    <PageShell>
      <ChapterBand tone="cantina">Play</ChapterBand>
      <div style={SECTIONS}>
        <Shelf
          title="Your Games"
          id="play-games"
          isEmpty={games === undefined || games.length === 0}
          empty={
            games !== undefined ? (
              "You're in no Games yet. Start one, or join one from an invite, in Build."
            ) : connected ? (
              <Pending label="your Games" />
            ) : (
              'Your Games list once the connection returns.'
            )
          }
        >
          {games?.map((game) => (
            <PlayGameItem key={game._id} game={game} pilots={gamePilots(pilots, game._id)} />
          ))}
        </Shelf>
        <Shelf
          title="Solo"
          id="play-solo"
          note="A Pilot from your shelf, played without a Game."
          isEmpty={solo.length === 0}
          empty="No Pilots on your shelf."
        >
          {solo.map((pilot) => (
            <li key={pilot.pilotId} style={ITEM}>
              <UnitRow
                kind="pilot"
                name={pilot.name}
                labels={
                  <Badge shape="stamp" size="compact" surface="inverse">
                    {pilot.mechName ?? 'No Mech'}
                  </Badge>
                }
                controls={
                  <AppLink
                    href={`/play/${pilot.pilotId}`}
                    aria-label={`Play ${pilot.name} solo`}
                    className={buttonVariants({ variant: 'primary', size: 'mini' })}
                    style={LINK}
                  >
                    Play solo
                  </AppLink>
                }
              />
            </li>
          ))}
        </Shelf>
        <PlayDiscordSection />
      </div>
    </PageShell>
  )
}

/**
 * One of your Games, as the play-entry wireframe draws it: its name, your
 * pilots in it, how many are here, a MEDIATOR stamp where you mediate it and a
 * Downtime chip while it is in Downtime; then its doors, Mediate and Play
 * (one Play reads "Play"; several name their pilot).
 */
function PlayGameItem({
  game,
  pilots,
}: {
  game: GameSummary
  pilots: readonly { id: string; name: string }[]
}) {
  const downtime = useQuery(api.downtime.state, { gameId: game._id as Id<'games'> })
  const seen = useQuery(api.seats.presence, { gameId: game._id as Id<'games'> })
  const now = usePresenceClock()
  const here = seen?.filter((at) => isPresent(at, now)).length ?? 0
  return (
    <li style={ITEM}>
      <Card size="compact">
        <div style={GAME}>
          <Cluster gap={8}>
            <span className="su-play-crew-dot" data-present={here > 0 || undefined} />
            <h3 style={GAME_NAME}>{game.name}</h3>
            {pilots.map((pilot) => (
              <Badge key={pilot.id} shape="stamp" size="compact" surface="inverse">
                {pilot.name}
              </Badge>
            ))}
            {here > 0 && (
              <Badge shape="stamp" size="compact" surface="dashed">
                {here} here
              </Badge>
            )}
            {game.mediator && (
              <Badge shape="stamp" size="compact">
                Mediator
              </Badge>
            )}
            {downtime?.running && (
              <Badge shape="stamp" size="compact" surface="inverse">
                Downtime
              </Badge>
            )}
          </Cluster>
          <Cluster gap={8}>
            {game.mediator && (
              <AppLink
                href={`/play/game/${game._id}`}
                aria-label={`Mediate ${game.name}`}
                className={MEDIATE}
                style={LINK}
              >
                Mediate
              </AppLink>
            )}
            {pilots.map((pilot) => (
              <AppLink
                key={pilot.id}
                href={`/play/${pilot.id}`}
                aria-label={`Play ${pilot.name} in ${game.name}`}
                className={PLAY}
                style={LINK}
              >
                {pilots.length === 1 ? 'Play' : `Play ${pilot.name}`}
              </AppLink>
            ))}
            {!game.mediator && pilots.length === 0 && (
              <Text variant="hint">None of your Pilots is in this Game.</Text>
            )}
          </Cluster>
        </div>
      </Card>
    </li>
  )
}
