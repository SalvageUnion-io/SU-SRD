/**
 * PlayLanding — the Play hub (`/play/`, ADR-052 §4): one tap from here into
 * any Game, its page or its dashboard, and any solo pilot. A Manage page
 * (ruleset §1.9): paper under the `play` band, Slab sections, Rows that link.
 *
 *  - **+ New Game** (`NewGameControl`, from a name or a template) and **Join**
 *    (paste an invite link, or its token, to open the invite screen), at the
 *    head of the page.
 *  - **Your Games** (`games.listMine`): one Row per Game, the whole Row opening
 *    the Game's page in Play (`/play/games/$gameId`), with your role, how many
 *    are here now (the seats' heartbeats, `seats.presence`, play.md §7) and the
 *    Downtime state (`downtime.state`) as chips, and one rust door in its chip
 *    group: Mediate where you mediate it, else Play <your pilot>
 *    (`playHub.model.ts`).
 *  - **Solo**: each pilot you own that is in no Game, with its mech's chip or
 *    "No Mech", and Play solo.
 *  - **Discord**: the channels play posts to (`PlayDiscordSection`).
 *
 * Signed out there is nothing to play, so it asks you to sign in. The store
 * holds only your own pilots, so every pilot it lists is yours to play.
 * Disconnected, your pilots still list from the store; the Game list, New
 * Game and Join wait for the connection.
 */

import { PRODUCT } from 'game-domain/product'
import '../styles/play/play.css'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { isPresent } from 'game-domain/schemas/seat'
import type { CSSProperties, FormEvent } from 'react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { NewGameControl } from '../build/games/NewGameControl'
import { Shelf } from '../build/shelves/Shelf'
import {
  Badge,
  Button,
  buttonVariants,
  ChapterBand,
  Entity,
  FieldError,
  Grid,
  Input,
  PageShell,
  Pending,
  Stat,
  tokens,
} from '../components/index'
import { AppLink } from '../components/shared/AppLink'
import { UnitRow } from '../components/shared/UnitRow'
import { useGo } from '../components/shared/useGo'
import { playGamePath } from '../lib/barLinks'
import { useConnection } from '../lib/connection/connectionContext'
import { useHydrateEntities, useMechs, usePilots, useSoftLinkList } from '../lib/entities'
import { invitePath, inviteTokenFrom } from '../lib/games/inviteLink'
import { PlayDiscordSection } from './PlayDiscordSection'
import { PlayPending, PlayRefusal } from './PlayRefusal'
import { gamePilots, soloPilots } from './play.model'
import { gameChips, gameDoor, gameRowModel } from './playHub.model'
import { usePresenceClock } from './usePresenceClock'

type GameSummary = FunctionReturnType<typeof api.games.listMine>[number]

const MEASURE = '75rem'

const ITEM = { listStyle: 'none', minWidth: 0 } satisfies CSSProperties

const LINK = { textDecoration: 'none' } satisfies CSSProperties

/** The sections side by side where there is room, stacked on a phone. */
const SECTIONS = { alignItems: 'start' } satisfies CSSProperties

/** New Game and Join, at the page's head, packed to its far end. */
const ACTIONS = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  justifyContent: 'flex-end',
} satisfies CSSProperties

const JOIN = {
  alignItems: 'flex-start',
  display: 'flex',
  flex: '0 1 28rem',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  margin: 0,
} satisfies CSSProperties

const JOIN_FIELD = {
  display: 'flex',
  flex: '1 1 14rem',
  flexDirection: 'column',
  gap: tokens.space[4],
  minWidth: 0,
} satisfies CSSProperties

const JOIN_INPUT = { height: 'var(--size-compact)', width: '100%' } satisfies CSSProperties

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
    <PageShell
      measure={MEASURE}
      band={
        <ChapterBand tone="play" measure={MEASURE}>
          {PRODUCT.play}
        </ChapterBand>
      }
    >
      {connected && (
        <div style={ACTIONS}>
          <NewGameControl />
          <JoinGame />
        </div>
      )}
      <Grid min="20rem" gap={24} style={SECTIONS}>
        <Shelf
          title="Your Games"
          id="play-games"
          isEmpty={games === undefined || games.length === 0}
          empty={
            games !== undefined ? (
              'You’re in no Games yet. Start one with + New Game, or join one with its invite link.'
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
          note="Pilots you own that are not in a Game."
          isEmpty={solo.length === 0}
          empty="No Pilots outside a Game."
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
      </Grid>
    </PageShell>
  )
}

/**
 * Join a Game: paste its invite link (or the token alone) and Join opens the
 * invite screen, which does the joining. Anything that is not a link or a
 * token says so here rather than opening a dead link's page.
 */
function JoinGame() {
  const go = useGo()
  const [pasted, setPasted] = useState('')
  const [wrong, setWrong] = useState(false)

  function join(event: FormEvent) {
    event.preventDefault()
    const token = inviteTokenFrom(pasted)
    if (token === null) {
      setWrong(true)
      return
    }
    go(invitePath(token))
  }

  return (
    <form style={JOIN} onSubmit={join} aria-label="Join a Game">
      <div style={JOIN_FIELD}>
        <Input
          aria-label="Invite link"
          placeholder="Paste an invite link to join…"
          value={pasted}
          onChange={(e) => {
            setPasted(e.target.value)
            setWrong(false)
          }}
          style={JOIN_INPUT}
        />
        <FieldError>{wrong ? 'That is not an invite link.' : null}</FieldError>
      </div>
      <Button type="submit" variant="default" size="compact" disabled={pasted.trim() === ''}>
        Join
      </Button>
    </form>
  )
}

/**
 * One of your Games, as a Row: the whole Row opens the Game's page; its chips
 * say your role, how many are here and the Downtime state; its one door,
 * last in the chip group, goes into play.
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
  const chips = gameChips({ mediator: game.mediator, here, downtime })
  const door = gameDoor(game, pilots)
  return (
    <li style={ITEM}>
      <Entity
        form="row"
        model={gameRowModel(game.name)}
        titleAs="h3"
        mode={{ kind: 'link', href: playGamePath(game._id) }}
        labels={chips.map((chip) => (
          <Stat
            key={chip.key}
            orientation="horizontal"
            label={chip.label}
            value={chip.value}
            size="compact"
          />
        ))}
        trailing={
          door ? (
            <AppLink
              href={door.href}
              aria-label={door.ariaLabel}
              className={buttonVariants({ variant: 'primary', size: 'compact' })}
              style={LINK}
            >
              {door.label}
            </AppLink>
          ) : undefined
        }
      />
    </li>
  )
}
