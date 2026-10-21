/**
 * PlayLanding — the Play hub (`/play/`, ADR-052 §4): your Games, and one tap
 * from each into play. Play only plays (owner, round 8: "don't overflow with
 * build func, focus on games"): nothing here makes or keeps a unit; each unit
 * opens its sheet in Build. A Manage page (ruleset §1.9): paper under the
 * `play` band.
 *
 *  - **The band**: **+ New Game** (`NewGameControl`, from a name or a
 *    template) and **Join with a link** (paste an invite link, or its token,
 *    to open the invite screen), its controls.
 *  - **Your Games** (`games.listMine`), the page: one contentful Compact per
 *    Game, the whole Compact opening the Game's page in Play
 *    (`/play/games/$gameId`). Its chips are your role, how many are here now
 *    (the seats' heartbeats, `seats.presence`, play.md §7), the Downtime state
 *    (`downtime.state`) and its Discord channel (`channelBindings.mine`); its
 *    body the crew as header-only Minis (`entities.listForGame`, `gameCrew`);
 *    its one door, last in the chip group: Mediate where you mediate it, else
 *    Play <your pilot> (`playHub.model.ts`).
 *  - **Play solo**, under the Games: each pilot you own that is in no Game,
 *    with its mech or "No Mech", and Play solo.
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
import { gamePath } from 'game-domain/entityKinds'
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
  ChapterBand,
  Entity,
  FieldError,
  Input,
  ModalShell,
  PageShell,
  Pending,
  Stat,
  tokens,
} from '../components/index'
import { RoutePending } from '../components/shared/RouteFallbacks'
import { UnitRow } from '../components/shared/UnitRow'
import { useGo } from '../components/shared/useGo'
import { useConnection } from '../lib/connection/connectionContext'
import { useHydrateEntities, useMechs, usePilots, useSoftLinkList } from '../lib/entities'
import { gameRowModel } from '../lib/games/containerRow.model'
import { invitePath, inviteTokenFrom } from '../lib/games/inviteLink'
import type { MyChannels } from './channels.model'
import { channelTag } from './channels.model'
import { PlayRefusal } from './PlayRefusal'
import { gamePilots, soloPilots } from './play.model'
import { gameChips, gameCrew, gameDoor } from './playHub.model'
import { usePresenceClock } from './usePresenceClock'

type GameSummary = FunctionReturnType<typeof api.games.listMine>[number]

/** One column of Games: each card wide enough for its crew on a line or two. */
const MEASURE = '60rem'

const ITEM = { listStyle: 'none', minWidth: 0 } satisfies CSSProperties

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
} satisfies CSSProperties

/** The band's controls, packed to its far end. */
const CONTROLS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  justifyContent: 'flex-end',
} satisfies CSSProperties

const JOIN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  margin: 0,
  padding: tokens.space[20],
} satisfies CSSProperties

const JOIN_ROW = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
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
        link={{ href: '/sign-in', label: 'Sign in with Discord', back: false }}
      />
    )
  }
  if (mode === 'connecting') return <RoutePending label="your session" />
  if (mode === 'connected') return <ConnectedPlayLanding />
  return <PlayLandingView games={undefined} channels={undefined} />
}

function ConnectedPlayLanding() {
  const games = useQuery(api.games.listMine, {})
  const channels = useQuery(api.channelBindings.mine, {}) as MyChannels | undefined
  return <PlayLandingView games={games} channels={channels} connected />
}

type PlayLandingViewProps = {
  /** Your Games; undefined while they load, or with no server to ask. */
  games: readonly GameSummary[] | undefined
  /** Where each Game's rolls post; undefined while it loads. */
  channels: MyChannels | undefined
  /** There is a server to ask: an unanswered list is loading, not waiting. */
  connected?: boolean
}

function PlayLandingView({ games, channels, connected = false }: PlayLandingViewProps) {
  useHydrateEntities(['pilot', 'mech', 'softLink'])
  const pilots = usePilots()
  const solo = soloPilots(pilots, useMechs(), useSoftLinkList())
  const channelOf = new Map(
    (channels?.games ?? []).map((g) => [g.gameId, channelTag(g.binding)] as const)
  )

  return (
    <PageShell
      measure={MEASURE}
      band={
        <ChapterBand
          tone="play"
          measure={MEASURE}
          asideAt="controls"
          aside={
            connected ? (
              <div style={CONTROLS}>
                <NewGameControl />
                <JoinGame />
              </div>
            ) : undefined
          }
        >
          {PRODUCT.play}
        </ChapterBand>
      }
    >
      <div style={BODY}>
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
            <PlayGameItem
              key={game._id}
              game={game}
              pilots={gamePilots(pilots, game._id)}
              channel={channelOf.get(game._id) ?? null}
            />
          ))}
        </Shelf>
        <Shelf
          title="Play solo"
          id="play-solo"
          isEmpty={solo.length === 0}
          empty="Every Pilot of yours is in a Game."
        >
          {solo.map((pilot) => (
            <li key={pilot.pilotId} style={ITEM}>
              <UnitRow
                kind="pilot"
                name={pilot.name}
                // Its mech, the header-only Mini of a linked unit, never a
                // chip (owner, round 4); with none, the stamp says so.
                {...(pilot.mechName === null
                  ? {
                      labels: (
                        <Badge shape="stamp" size="compact" surface="inverse">
                          No Mech
                        </Badge>
                      ),
                    }
                  : {
                      linked: [
                        {
                          key: 'mech',
                          kind: 'mech' as const,
                          name: pilot.mechName,
                          ...(pilot.mechId ? { href: `/sheet/mech/${pilot.mechId}` } : {}),
                        },
                      ],
                    })}
                controls={
                  <Button
                    href={`/play/${pilot.pilotId}`}
                    aria-label={`Play ${pilot.name} solo`}
                    variant="ink"
                    size="mini"
                  >
                    Play solo
                  </Button>
                }
              />
            </li>
          ))}
        </Shelf>
      </div>
    </PageShell>
  )
}

/**
 * Join with a link: a band control opening one field. Paste an invite link
 * (or the token alone) and Join opens the invite screen, which does the
 * joining. Anything that is not a link or a token says so here rather than
 * opening a dead link's page.
 */
function JoinGame() {
  const go = useGo()
  const [open, setOpen] = useState(false)
  const [pasted, setPasted] = useState('')
  const [wrong, setWrong] = useState(false)

  function join(event: FormEvent) {
    event.preventDefault()
    const token = inviteTokenFrom(pasted)
    if (token === null) {
      setWrong(true)
      return
    }
    setOpen(false)
    go(invitePath(token))
  }

  return (
    <>
      <Button variant="default" size="compact" onClick={() => setOpen(true)}>
        Join with a link
      </Button>
      <ModalShell open={open} onOpenChange={setOpen} title="Join a Game">
        <form style={JOIN} onSubmit={join} aria-label="Join a Game">
          <div style={JOIN_ROW}>
            <div style={JOIN_FIELD}>
              <Input
                aria-label="Invite link"
                placeholder="Paste an invite link…"
                value={pasted}
                onChange={(e) => {
                  setPasted(e.target.value)
                  setWrong(false)
                }}
                style={JOIN_INPUT}
              />
              <FieldError>{wrong ? 'That is not an invite link.' : null}</FieldError>
            </div>
            <Button type="submit" variant="primary" size="compact" disabled={pasted.trim() === ''}>
              Join
            </Button>
          </div>
        </form>
      </ModalShell>
    </>
  )
}

/**
 * One of your Games, as a contentful Compact: the whole Compact opens the
 * Game's page; its chips say your role, how many are here, the Downtime state
 * and its channel; its body is the crew, each unit opening its sheet; its one
 * door, last in the chip group, goes into play.
 */
function PlayGameItem({
  game,
  pilots,
  channel,
}: {
  game: GameSummary
  pilots: readonly { id: string; name: string }[]
  channel: string | null
}) {
  const gameId = game._id as Id<'games'>
  const downtime = useQuery(api.downtime.state, { gameId })
  const seen = useQuery(api.seats.presence, { gameId })
  const listing = useQuery(api.entities.listForGame, { gameId })
  const vitals = useQuery(api.crew.vitals, { gameId })
  const now = usePresenceClock()
  const here = seen?.filter((at) => isPresent(at, now)).length ?? 0
  const chips = gameChips({ mediator: game.mediator, here, downtime, channel })
  const door = gameDoor(game, pilots)
  const crew =
    listing && vitals
      ? gameCrew({
          crawlers: listing.crawlers,
          primaryCrawlerId: listing.primaryCrawlerId,
          pilots: vitals.pilots,
          mechs: vitals.mechs,
        })
      : []
  return (
    <li style={ITEM}>
      <Entity
        size="compact"
        model={gameRowModel(game.name)}
        titleAs="h3"
        mode={{ kind: 'link', href: gamePath(game._id) }}
        labels={chips.map((chip) => (
          <Stat key={chip.key} label={chip.label} value={chip.value} size="compact" />
        ))}
        {...(crew.length > 0 ? { linked: crew } : {})}
        trailing={
          door ? (
            // Ink on the Game's pink, as its stamps are (owner, round 4:
            // "'Mediate' color looks odd against pink"), a chip's height.
            <Button href={door.href} aria-label={door.ariaLabel} variant="ink" size="mini">
              {door.label}
            </Button>
          ) : undefined
        }
      />
    </li>
  )
}
