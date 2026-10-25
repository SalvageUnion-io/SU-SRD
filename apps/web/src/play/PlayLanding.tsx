/**
 * PlayLanding — the Play hub (`/play/`, ADR-052 §4): your Games, and one tap
 * from each into play. Play only plays (ADR-052 §3): nothing here makes or
 * keeps a unit; each unit
 * opens its sheet in Build. A Manage page (ruleset §1.9): paper under the
 * `play` band, on the page measure every hub takes.
 *
 *  - **The band**: Play's name under `PRODUCT.playDescriptor`, with the
 *    legacy tagline quoted beside it, as Build's front door and the SRD's
 *    home wear theirs, so the three areas' homes open on the same band.
 *  - **Your Games** (`games.listMine`), the page: one contentful Compact per
 *    Game, the whole Compact opening the Game's page in Play
 *    (`/play/games/$gameId`). Its chips are your role, how many are here now
 *    (the seats' heartbeats, `seats.presence`, play.md §7), the Downtime state
 *    (`downtime.state`) and its Discord channel (`channelBindings.mine`); its
 *    body the crew as header-only Minis (`entities.listForGame`, `gameCrew`);
 *    its one door, last in the chip group: Mediate where you mediate it, else
 *    Play <your pilot> (`playHub.model.ts`). At its rule's end, as each
 *    Training Bay shelf ends on its "+ New…": **+ New Game**
 *    (`NewGameControl`, from a name or a template) and **Join with a link**
 *    (paste an invite link, or its token, to open the invite screen).
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
import { cockpitPath, gamePath, invitePath, sheetPath } from 'game-domain/entityKinds'
import { isPresent } from 'game-domain/schemas/seat'
import type { CSSProperties, FormEvent } from 'react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { NewGameControl } from '../build/games/NewGameControl'
import { Shelf } from '../build/shelves/Shelf'
import { capsLabel } from '../components/atoms/capsLabel'
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
import { Tagline } from '../components/Tagline'
import { useHydrateEntities, useMechs, usePilots, useSoftLinkList } from '../lib/entities'
import { gameRowModel } from '../lib/games/containerRow.model'
import { inviteTokenFrom } from '../lib/games/inviteLink'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { crewPair } from '../lib/units/crewPair'
import { playCopy } from '../messages/play'
import { useSync } from '../replica/syncContext'
import type { MyChannels } from './channels.model'
import { channelTag } from './channels.model'
import { PlayRefusal } from './PlayRefusal'
import type { SoloPilot } from './play.model'
import { gamePilots, soloPilots } from './play.model'
import { gameChips, gameCrew, gameDoor } from './playHub.model'
import { usePresenceClock } from './usePresenceClock'

type GameSummary = FunctionReturnType<typeof api.games.listMine>[number]

const ITEM = { listStyle: 'none', minWidth: 0 } satisfies CSSProperties

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
} satisfies CSSProperties

/** The kicker: brand caps, the eyebrow's tracking. */
const KICKER_CAPS = capsLabel({ size: 'caption', tracking: 'eyebrow' })

/** The Your Games shelf's controls, at its rule's end. */
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
  const { status } = useSync()
  if (status === 'signedOut') {
    return (
      <PlayRefusal
        title={playCopy('signInToPlay')}
        body={playCopy('playRunsYourPilotsSolo2')}
        link={{ href: '/sign-in', label: playCopy('signInWithDiscord'), back: false }}
      />
    )
  }
  if (status === 'syncing') return <RoutePending label={playCopy('yourSession')} />
  if (status === 'live') return <ConnectedPlayLanding />
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
      measure={PAGE_MEASURE}
      band={
        <ChapterBand
          tone="play"
          measure={PAGE_MEASURE}
          eyebrow={<span className={KICKER_CAPS}>{PRODUCT.playDescriptor}</span>}
          asideAt="notch"
          aside={<Tagline />}
        >
          {PRODUCT.play}
        </ChapterBand>
      }
    >
      <div style={BODY}>
        <Shelf
          title={playCopy('yourGames')}
          id="play-games"
          action={
            connected ? (
              <div style={CONTROLS}>
                <NewGameControl />
                <JoinGame />
              </div>
            ) : undefined
          }
          isEmpty={games === undefined || games.length === 0}
          empty={
            games !== undefined ? (
              'You’re in no Games yet. Start one with + New Game, or join one with its invite link.'
            ) : connected ? (
              <Pending label={playCopy('yourGames2')} />
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
          title={playCopy('playSolo')}
          id="play-solo"
          isEmpty={solo.length === 0}
          empty={playCopy('everyPilotOfYoursIs')}
        >
          {solo.map((pilot) => (
            <li key={pilot.pilotId} style={ITEM}>
              <SoloPilotRow pilot={pilot} />
            </li>
          ))}
        </Shelf>
      </div>
    </PageShell>
  )
}

/**
 * A shelf pilot under Play solo, by the pair rule (`crewPair`): not aboard,
 * it is the pilot, its HP and AP, with a MECH chip naming its mech; with
 * none, the stamp says so.
 */
function SoloPilotRow({ pilot }: { pilot: SoloPilot }) {
  const pair = crewPair({
    pilot: { id: pilot.pilotId, name: pilot.name, readings: pilot.readings },
    mech:
      pilot.mechName === null
        ? null
        : {
            id: pilot.mechId ?? pilot.mechName,
            name: pilot.mechName,
            href: pilot.mechId === null ? undefined : sheetPath('mech', pilot.mechId),
          },
    boarded: false,
  })
  return (
    <UnitRow
      kind={pair.kind}
      name={pair.name}
      readings={pair.readings}
      {...(pair.relations
        ? { relations: [...pair.relations] }
        : {
            labels: (
              <Badge shape="stamp" size="compact" surface="inverse">
                {playCopy('noMech')}
              </Badge>
            ),
          })}
      controls={
        <Button
          href={cockpitPath(pilot.pilotId)}
          aria-label={playCopy('playSolo2', { name: pilot.name })}
          variant="ink"
          size="mini"
        >
          {playCopy('playSolo')}
        </Button>
      }
    />
  )
}

/**
 * Join with a link: a Your Games control opening one field. Paste an invite link
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
      <Button variant="default" size="mini" onClick={() => setOpen(true)}>
        {playCopy('joinWithALink')}
      </Button>
      <ModalShell open={open} onOpenChange={setOpen} title={playCopy('joinAGame')}>
        <form style={JOIN} onSubmit={join} aria-label={playCopy('joinAGame')}>
          <div style={JOIN_ROW}>
            <div style={JOIN_FIELD}>
              <Input
                aria-label={playCopy('inviteLink')}
                placeholder={playCopy('pasteAnInviteLink')}
                value={pasted}
                onChange={(e) => {
                  setPasted(e.target.value)
                  setWrong(false)
                }}
                style={JOIN_INPUT}
              />
              <FieldError>{wrong ? playCopy('thatIsNotAnInvite') : null}</FieldError>
            </div>
            <Button type="submit" variant="primary" size="compact" disabled={pasted.trim() === ''}>
              {playCopy('join')}
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
  const downtime = useQuery(api.downtime.state, { gameId }) ?? undefined
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
    <li className="su-hub-game" style={ITEM}>
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
            // Ink on the Game's pink, as its stamps are (R44: a control on a
            // pink band is ink), a chip's height.
            <Button href={door.href} aria-label={door.ariaLabel} variant="ink" size="mini">
              {door.label}
            </Button>
          ) : undefined
        }
      />
    </li>
  )
}
