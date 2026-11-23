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
 *    (`downtime.state`), where the campaign is (proposals open, last played,
 *    the next plan: `useCampaign`, r7 C11) and its Discord channel
 *    (`channelBindings.mine`); its body the crew as header-only Minis
 *    (`useGameListing`, `gameCrew`), your own pilot first, marked Yours;
 *    its doors, last in the chip group: where you mediate it, Start group
 *    session (`useGameSession`) until one is live, then Mediate; then Play
 *    <pilot> for each pilot of
 *    yours in it (`playHub.model.ts`). Session live is a chip too. At its rule's end, as each
 *    Training Bay shelf ends on its "+ New…": **+ New Game**
 *    (`NewGameControl`, from a name or a template) and **Join with a link**
 *    (paste an invite link, or its token, to open the invite screen).
 *
 *  - **Your Pilots** (`YourPilots`): every pilot of yours with its Play door,
 *    in a Game or not, so the header's Play always has something to play; a
 *    pilot in no Game plays solo. Every Training Bay pilot line carries the
 *    same door (ADR-066).
 *
 * Signed out there is nothing to play, so it is Play's front door
 * (`PlayFrontDoor`): the pitch and its sign-in, what happens at the table,
 * and the Starter Set's crew. The store
 * holds only your own pilots, so every pilot it lists is yours to play.
 * Disconnected, your pilots still list from the store; the Game list, New
 * Game and Join wait for the connection.
 */

import { pilotCallsign } from 'game-domain/pilotLabel'
import { PRODUCT } from 'game-domain/product'
import '../styles/play/play.css'
import { gamePath, invitePath } from 'game-domain/entityKinds'
import type { CSSProperties, FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { assetUrl } from 'salvageunion-reference'
import { NewGameControl } from '../build/games/NewGameControl'
import { FrontDoor } from '../build/roster/FrontDoor'
import { Shelf } from '../build/shelves/Shelf'
import { Shelves } from '../build/shelves/Shelves'
import { ShelvesPart } from '../build/shelves/shelvesPart.model'
import { FieldError, PageShell, StartHere } from '../components/app'
import type { StartHereStep } from '../components/index'
import {
  assetSrcSetFor,
  Button,
  ChapterBand,
  Entity,
  Input,
  ModalShell,
  Pending,
  SlabSection,
  Stat,
  Text,
  tokens,
} from '../components/index'
import { RoutePending } from '../components/shared/RouteFallbacks'
import { useGo } from '../components/shared/useGo'
import { Tagline } from '../components/Tagline'
import { signIn } from '../lib/auth/session'
import { cn } from '../lib/cn'
import { useOwnUnits } from '../lib/entities'
import { formatAgo, todayDay } from '../lib/formatDate'
import { gameRowModel } from '../lib/games/containerRow.model'
import { MEDIATORS_KIT_ANCHOR } from '../lib/games/gameRoster'
import { inviteTokenFrom } from '../lib/games/inviteLink'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { playCopy } from '../messages/play'
import { playGamesCopy } from '../messages/play-games'
import { useEncounters } from '../replica/collections'
import { useGameListing } from '../replica/gameListing'
import type { GameCallResult } from '../replica/roomCalls'
import { useGamesQuery, useViewerId } from '../replica/roomCalls'
import { useSync } from '../replica/syncContext'
import { useTableRead } from '../replica/useTable'
import type { MyChannels } from './channels.model'
import { channelTag } from './channels.model'
import { hereCount } from './crew.model'
import { lastSession } from './games/lastSession.model'
import { sessionPlans } from './games/useNextSession'
import { gamePilots } from './play.model'
import { gameChips, gameCrew, gameDoors } from './playHub.model'
import { useGamePresence } from './useGamePresence'
import { useGameSession } from './useGameSession'
import { YourPilots } from './YourPilots'

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

const JOIN_TEXT = { margin: 0 } satisfies CSSProperties

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
/** Where the sub-nav's "Join with a link" points, as a route in the app. */
const JOIN_ROUTE = '/games/#join'

const AT_THE_TABLE_ART = [
  tileArt('classes/scout.webp', playCopy('artScout')),
  tileArt('chassis/mazona.webp', playCopy('artMazona')),
  tileArt('bio-titans/scylla.webp', playCopy('artScylla')),
]

/**
 * Play signed out: its front door (`FrontDoor`), its steps "At the table",
 * with art.
 */
function PlayFrontDoor() {
  // Signed out there is no Join dialog to open: the sub-nav's "Join with a
  // link" opens a short panel that says what an invite link is and that
  // joining needs a sign-in, before anything leaves the site (r5 B20). Its
  // Sign in comes back to `/games/#join`, where the dialog opens itself
  // (r3 E3, MD-03). Heard before the router, which would only scroll to the
  // card that wears the id.
  const [joining, setJoining] = useState(false)
  useEffect(() => {
    const pressed = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href$="#join"]') : null
      if (link === null) return
      event.preventDefault()
      event.stopPropagation()
      setJoining(true)
    }
    document.addEventListener('click', pressed, true)
    return () => document.removeEventListener('click', pressed, true)
  }, [])
  const steps = AT_THE_TABLE.map((step, index) => ({ ...step, art: AT_THE_TABLE_ART[index] }))
  return (
    <>
      <ModalShell open={joining} onOpenChange={setJoining} title={playCopy('joinWithALink')}>
        <div style={JOIN}>
          <p style={JOIN_TEXT}>{playCopy('joinSignedOut')}</p>
          <div style={JOIN_ROW}>
            <Button variant="primary" size="compact" onClick={() => signIn(JOIN_ROUTE)}>
              {playCopy('joinSignIn')}
            </Button>
          </div>
        </div>
      </ModalShell>
      <FrontDoor
        area="play"
        steps={
          <StartHere
            id="play-at-the-table"
            title={playCopy('atTheTable')}
            steps={steps}
            numbered={false}
            // Where Play's sub-nav lands signed out (`AREA_NAV.play`): sharing a
            // table is how you join one, and Mediate is what the Kit is for.
            anchors={{ table: 'join', mediate: MEDIATORS_KIT_ANCHOR }}
          />
        }
      />
    </>
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
  // Your own: the replica also holds every crewmate's pilot, for Play (LG-01).
  const pilots = useOwnUnits('pilot')
  // The Kit is a Mediator's (r8 C8, LG8-19): shown to whoever runs a table,
  // and to anyone whose Kit already holds something, so nothing made is out of reach.
  const npcs = useOwnUnits('npc')
  const encounters = useEncounters((s) => s.encounters)
  const showsKit =
    connected &&
    ((games ?? []).some((g) => g.mediator || g.tableRunner) ||
      npcs.length > 0 ||
      encounters.length > 0)
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
                <NewGameControl />
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
              // The seat's door is told apart by callsign when there are several (`gameDoors`).
              pilots={gamePilots(pilots, game._id).map((p) => ({
                id: p.id,
                name: pilotCallsign(p),
              }))}
              channel={channelOf.get(game._id) ?? null}
            />
          ))}
        </Shelf>
        {/* What the header's Play can always play: your pilots, solo or in a Game. */}
        <YourPilots games={games} />
        {/* The Mediator's Kit lives with the tables
            it is for. */}
        {/* A plain player's Kit is its one line, the sub-nav's target (r8 C8). */}
        {connected && !showsKit && (
          <SlabSection id={MEDIATORS_KIT_ANCHOR} as="h2" title={playCopy('mediatorsKit')}>
            <Text variant="hint">{playGamesCopy('kitIsTheMediators')}</Text>
          </SlabSection>
        )}
        {showsKit && (
          // A band with its title's cut-out, as Your Games wears.
          <SlabSection
            id={MEDIATORS_KIT_ANCHOR}
            as="h2"
            title={playCopy('mediatorsKit')}
            className="su-mediator-kit-section"
            // The Kit's two lists, each under its own tab, side by side: the
            // section names the pair, never one list alone (Ledger law).
            bodyClassName={cn('su-shelf-ledgers', 'su-mediator-kit')}
          >
            <ShelvesPart.Provider value="kit">
              <Shelves />
            </ShelvesPart.Provider>
          </SlabSection>
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
  // A paste on arrival lands in the only field, never on Close (MD3-04).
  const linkField = useRef<HTMLInputElement | null>(null)
  // The sub-nav's "Join with a link" (`/games/#join`) lands here and opens it.
  // A router link changes the hash with no `hashchange`, and a second press
  // changes nothing at all, so the press itself is heard too (MD-03).
  useEffect(() => {
    const arrive = () => {
      if (window.location.hash === '#join') setOpen(true)
    }
    const pressed = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href$="#join"]') : null
      if (link !== null) setOpen(true)
    }
    arrive()
    window.addEventListener('hashchange', arrive)
    window.addEventListener('popstate', arrive)
    document.addEventListener('click', pressed)
    return () => {
      window.removeEventListener('hashchange', arrive)
      window.removeEventListener('popstate', arrive)
      document.removeEventListener('click', pressed)
    }
  }, [])

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
      <Button id="join" variant="default" size="compact" onClick={() => setOpen(true)}>
        {playCopy('joinWithALink')}
      </Button>
      <ModalShell
        open={open}
        onOpenChange={setOpen}
        title={playCopy('joinAGame')}
        initialFocus={linkField}
      >
        <form style={JOIN} onSubmit={join} aria-label={playCopy('joinAGame')}>
          <div style={JOIN_ROW}>
            <div style={JOIN_FIELD}>
              <Input
                ref={linkField}
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
 * Where a Game's campaign is (r7 C11, MD7-17): the proposals still open (the
 * viewer's to answer and the ones they sent), when the table last played
 * (`lastSession`) and the next plan (`sessionPlans`; the plan is the table
 * runner's alone).
 */
function useCampaign(game: GameSummary) {
  const gameId = game._id
  const events = useTableRead('changeLog.events', { gameId })
  const waiting = useTableRead('ops.pending', { gameId })
  const sent = useTableRead('ops.sent', { gameId })
  const plan = useGamesQuery('plan.get', game.tableRunner ? { gameId } : 'skip')
  const record = events === undefined ? null : lastSession(events)
  const endedAt = record?.endedAt ?? null
  const plans = sessionPlans(
    plan?.sessions ?? [],
    game.sessionDays ?? [],
    todayDay(),
    endedAt === null ? null : todayDay(new Date(endedAt))
  )
  return {
    pending: (waiting?.length ?? 0) + (sent ?? []).filter((p) => p.state === 'proposed').length,
    played: endedAt === null ? null : formatAgo(endedAt, Date.now()),
    next: plans.next,
  }
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
  const viewerId = useViewerId()
  const live = session?.live === true
  const campaign = useCampaign(game)
  const chips = gameChips({ mediator: game.mediator, live, here, downtime, channel, ...campaign })
  const doors = gameDoors(game, pilots, session === null ? null : live)
  const crew =
    listing && vitals
      ? gameCrew(
          {
            crawlers: listing.crawlers,
            primaryCrawlerId: listing.primaryCrawlerId,
            pilots: vitals.pilots,
            mechs: vitals.mechs,
          },
          viewerId,
          game.mediator || game.tableRunner
        )
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
              // any other is the paper plate beside it. Each is marked a
              // role's door, the one act whose look the viewer's role picks
              // (§3.14): a pilot's own line below says Play in rust.
              doors.map((door, index) =>
                door.start ? (
                  // Start the session, then open the Mediator's screen.
                  <Button
                    key={door.ariaLabel}
                    aria-label={door.ariaLabel}
                    variant={index === 0 ? 'primary' : 'default'}
                    size="mini"
                    data-role-door=""
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
                    key={door.ariaLabel}
                    href={door.href}
                    aria-label={door.ariaLabel}
                    variant={index === 0 ? 'primary' : 'default'}
                    size="mini"
                    data-role-door=""
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
