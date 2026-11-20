/**
 * PlayLanding — the Games hub (`/games/`, ADR-066): your Games, and one tap
 * from each into play. Play only plays (ADR-052 §3): nothing here makes or
 * keeps a unit; each unit
 * opens its sheet in Build. A Manage page (ruleset §1.9): paper under the
 * `play` band, on the page measure every hub takes.
 *
 *  - **The band**: the Games' name with the
 *    legacy tagline quoted beside it, as Build's front door and the SRD's
 *    home wear theirs, so the three areas' homes open on the same band.
 *  - **Your Games** (`games.listMine`), the page: one contentful Compact per
 *    Game, the whole Compact opening the Game's page in Play
 *    (`/games/$gameId`). Its chips are your role, how many are here now
 *    (the Game's room, `useGamePresence`, play.md §7), the Downtime state
 *    (`downtime.state`) and its Discord channel (`channelBindings.mine`); its
 *    body the crew as header-only Minis (`useGameListing`, `gameCrew`);
 *    its doors, last in the chip group: where you mediate it, Start group
 *    session (`useGameSession`) until one is live, then Mediate; then Play
 *    <pilot> (Join as <pilot> while a session is live) for each pilot of
 *    yours in it (`playHub.model.ts`). Session live is a chip too. At its rule's end, as each
 *    Training Bay shelf ends on its "+ New…": **+ New Game**
 *    (`NewGameControl`, from a name or a template) and **Join with a link**
 *    (paste an invite link, or its token, to open the invite screen).
 *
 * No solo list: a pilot in no Game plays from its own page's Play mode, and
 * every Training Bay pilot line carries that door (ADR-066).
 *
 * Signed out there is nothing to play, so it is Play's front door
 * (`PlayFrontDoor`): the pitch and its sign-in, what happens at the table,
 * and the Starter Set's crew. The store
 * holds only your own pilots, so every pilot it lists is yours to play.
 * Disconnected, your pilots still list from the store; the Game list, New
 * Game and Join wait for the connection.
 */

import { PRODUCT } from 'game-domain/product'
import '../styles/play/play.css'
import { gamePath, invitePath } from 'game-domain/entityKinds'
import type { CSSProperties, FormEvent } from 'react'
import { useState } from 'react'
import { assetUrl } from 'salvageunion-reference'
import { SignInControl } from '../build/account/SignInControl'
import { NewGameControl } from '../build/games/NewGameControl'
import { Shelf } from '../build/shelves/Shelf'
import { Shelves } from '../build/shelves/Shelves'
import { ShelvesPart } from '../build/shelves/shelvesPart'
import { StarterSetCrew } from '../build/starterSet/StarterSetCrew'
import type { StartHereStep } from '../components/index'
import {
  assetSrcSetFor,
  Button,
  ChapterBand,
  capsLabel,
  Entity,
  FieldError,
  FrontPitch,
  Input,
  ModalShell,
  PageShell,
  Pending,
  StartHere,
  Stat,
  tokens,
} from '../components/index'
import { RoutePending } from '../components/shared/RouteFallbacks'
import { useGo } from '../components/shared/useGo'
import { Tagline } from '../components/Tagline'
import { cn } from '../lib/cn'
import { useHydrateEntities, usePilots } from '../lib/entities'
import { gameRowModel } from '../lib/games/containerRow.model'
import { inviteTokenFrom } from '../lib/games/inviteLink'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { playCopy } from '../messages/play'
import { useGameListing } from '../replica/gameListing'
import type { GameCallResult } from '../replica/roomCalls'
import { useGamesQuery } from '../replica/roomCalls'
import { useSync } from '../replica/syncContext'
import { useTableRead } from '../replica/useTable'
import type { MyChannels } from './channels.model'
import { channelTag } from './channels.model'
import { hereCount } from './crew.model'
import { gamePilots } from './play.model'
import { gameChips, gameCrew, gameDoors } from './playHub.model'
import { useGamePresence } from './useGamePresence'
import { useGameSession } from './useGameSession'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

type GameSummary = GameCallResult<'games.listMine'>[number]

const ITEM = { listStyle: 'none', minWidth: 0 } satisfies CSSProperties

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
} satisfies CSSProperties

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

/**
 * What Play is, for a visitor who has not signed in: the front door's Start
 * Here tiles (`StartHere`), saying what happens at the table. No tile is a
 * link: each opens only once you are signed in.
 */
const AT_THE_TABLE: readonly StartHereStep[] = [
  {
    key: 'pilot',
    title: playCopy('runYourPilot'),
    tone: 'pilot',
    body: playCopy('runYourPilotBody'),
  },
  {
    key: 'table',
    title: playCopy('shareOneTable'),
    tone: 'crawler',
    body: playCopy('shareOneTableBody'),
  },
  {
    key: 'mediate',
    title: playCopy('mediate'),
    tone: 'ink',
    body: playCopy('mediateBody'),
  },
]

/** A tile's art from R2, by its object key. */
function tileArt(key: string, alt: string) {
  const url = assetUrl(key)
  const srcSet = assetSrcSetFor(url)
  return srcSet ? { url, srcSet, alt } : { url, alt }
}

/** Each "At the table" tile's art, in the tiles' order. */
const AT_THE_TABLE_ART = [
  tileArt('classes/scout.webp', playCopy('artScout')),
  tileArt('chassis/mazona.webp', playCopy('artMazona')),
  tileArt('bio-titans/scylla.webp', playCopy('artScylla')),
]

const FRONT_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
} satisfies CSSProperties

/** The Starter Set section: the pitch's second action jumps to it. */
const STARTER_ID = 'play-starter'

/**
 * Play signed out: its front door. The band on the page measure with its
 * kicker and tagline, as Build's front door; the pitch (`FrontPitch`) with
 * the page's one rust action (ruleset §3.13); "At the table" with art; then
 * the Starter Set's crew (`StarterSetCrew`), so a visitor with no Pilot has
 * something to open.
 */
function PlayFrontDoor() {
  const steps = AT_THE_TABLE.map((step, index) => ({ ...step, art: AT_THE_TABLE_ART[index] }))
  return (
    <PageShell
      measure={PAGE_MEASURE}
      band={
        <ChapterBand tone="play" measure={PAGE_MEASURE} asideAt="notch" aside={<Tagline />}>
          {PRODUCT.play}
        </ChapterBand>
      }
    >
      <div style={FRONT_BODY}>
        <FrontPitch
          value={playCopy('pitchValue')}
          actions={
            <>
              <SignInControl size="full" redirectTo="/games/" />
              <Button href={`#${STARTER_ID}`} variant="default" size="full">
                {playCopy('meetTheStarterCrew')}
              </Button>
            </>
          }
          note={playCopy('pitchNote')}
        >
          {playCopy('pitchLede')}
        </FrontPitch>
        <StartHere
          id="play-at-the-table"
          title={playCopy('atTheTable')}
          steps={steps}
          numbered={false}
        />
        <StarterSetCrew id={STARTER_ID} />
      </div>
    </PageShell>
  )
}

export function PlayLanding() {
  const { status } = useSync()
  // Signed out, the hub is Play's front door, in the home's dress.
  if (status === 'signedOut') return <PlayFrontDoor />
  if (status === 'syncing') return <RoutePending label={playCopy('yourSession')} />
  if (status === 'live') return <ConnectedPlayLanding />
  return <PlayLandingView games={undefined} channels={undefined} />
}

function ConnectedPlayLanding() {
  const games = useGamesQuery('games.listMine', {})
  const channels = useGamesQuery('channelBindings.mine', {}) as MyChannels | undefined
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
  useHydrateEntities(['pilot'])
  const pilots = usePilots()
  const channelOf = new Map(
    (channels?.games ?? []).map((g) => [g.gameId, channelTag(g.binding)] as const)
  )

  return (
    <PageShell
      measure={PAGE_MEASURE}
      band={
        <ChapterBand tone="play" measure={PAGE_MEASURE} asideAt="notch" aside={<Tagline />}>
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
                <NewGameControl beside={games !== undefined && games.length > 0} />
                <JoinGame />
              </div>
            ) : undefined
          }
          isEmpty={games === undefined || games.length === 0}
          empty={
            games !== undefined ? (
              playCopy('noGamesYet')
            ) : connected ? (
              <Pending as="span" label={playCopy('yourGames2')} />
            ) : (
              playCopy('gamesListOffline')
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
        {/* The Mediator's Kit lives with the tables
            it is for. */}
        {connected && (
          <section id="mediators-kit" className="su-mediator-kit-section">
            {/* A plain ruled label, its tables each wear their own cut-out. */}
            <header className="su-rule-head su-rule-head--over">
              <h2 className={cn('su-rule-head__label', CAPS, CAPS)}>{playCopy('mediatorsKit')}</h2>
            </header>
            <ShelvesPart.Provider value="kit">
              <Shelves />
            </ShelvesPart.Provider>
          </section>
        )}
      </div>
    </PageShell>
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
      <Button variant="default" size="compact" onClick={() => setOpen(true)}>
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
 * and its channel; its body is the crew, each unit opening its sheet; its
 * doors, last in the chip group, go into play.
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
  const gameId = game._id
  const downtime = useTableRead('downtime.state', { gameId }) ?? undefined
  const listing = useGameListing(gameId)
  const vitals = useTableRead('crew.vitals', { gameId })
  const presence = useGamePresence(gameId, 'watch')
  const here = hereCount(vitals?.pilots, presence)
  const session = useGameSession(gameId)
  const go = useGo()
  const live = session?.live === true
  const chips = gameChips({ mediator: game.mediator, live, here, downtime, channel })
  const doors = gameDoors(game, pilots, session === null ? null : live)
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
        // The Game's name is never cut (R56): its doors are the body's first
        // row when they don't fit beside it.
        wholeName
        mode={{ kind: 'link', href: gamePath(game._id) }}
        labels={chips.map((chip) => (
          <Stat key={chip.key} label={chip.label} value={chip.value} size="mini" />
        ))}
        {...(crew.length > 0 ? { linked: crew } : {})}
        trailing={
          doors.length > 0
            ? // A chip's height (C8). The first is your role's door, so rust
              // (ruleset §1.9, §3.13: Mediate where you mediate, else Play);
              // any other is the paper plate beside it.
              doors.map((door, index) =>
                door.start ? (
                  // Start the session, then open the Mediator's screen.
                  <Button
                    key={door.href}
                    aria-label={door.ariaLabel}
                    variant={index === 0 ? 'primary' : 'default'}
                    size="mini"
                    disabled={session === null || !session.canWrite || session.pending}
                    onClick={() => {
                      void session?.start().then((started) => {
                        if (started) go(door.href)
                      })
                    }}
                  >
                    {door.label}
                  </Button>
                ) : (
                  <Button
                    key={door.href}
                    href={door.href}
                    aria-label={door.ariaLabel}
                    variant={index === 0 ? 'primary' : 'default'}
                    size="mini"
                  >
                    {door.label}
                  </Button>
                )
              )
            : undefined
        }
      />
    </li>
  )
}
