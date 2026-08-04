import { useState } from 'react'
import { Button, Card, EntityRow, ModalShell, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useNavigate } from '@tanstack/react-router'

import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { ConvexPending } from '../shared/ConvexPending'
import { SignInControl } from '../account/SignInControl'
import { GameRow } from './GameRow'
import { INPUT, PAGE, STAMP } from './gameChrome'

/**
 * Games — the shelf of tables you belong to.
 *
 * This screen is about *choosing* a Game: start one, join one, open one. The
 * crew, invites, proposals and Downtime all live on the Game's own screen,
 * because stacking them under every list entry did not survive a second Game.
 *
 * The whole screen is gated on `mode === 'connected'`. That is not defensive
 * coding — a Game is inherently shared state, so there is nothing meaningful to
 * show a Solo user and nothing safe to show a Disconnected one, whose view
 * would be a stale snapshot of a roster that may have changed.
 */

type TemplateList = FunctionReturnType<typeof api.templates.list>

/**
 * "From a template" as a dialog rather than a third stacked card.
 *
 * The template list is fetched by the PARENT and handed down, deliberately:
 * `open` is local state here, so toggling it re-renders only this component. If
 * the query lived here too, that re-render would fire a Convex subscription read
 * on its own — which is harmless in the app but makes the screen's query
 * sequence depend on which child last changed state, and the connected tests
 * answer queries by call order. Lifting it keeps the screen's reads to one
 * fixed pass.
 *
 * A template is a *list to read* — each entry carries a name and a paragraph of
 * description — and inlining that list put a wall of prose between the controls
 * and the games it was meant to sit beside. Behind a button the band stays a
 * band, and the reading happens when you have asked for it.
 */
function TemplatePicker({ templates }: { templates: TemplateList | undefined }) {
  const createFromTemplate = useMutation(api.templates.createGame)
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="default"
        size="compact"
        // Nothing to choose from until the list lands, and an empty dialog reads
        // as broken rather than as loading.
        disabled={templates === undefined || templates.length === 0}
        onClick={() => setOpen(true)}
      >
        From a template
      </Button>
      <ModalShell
        open={open}
        onOpenChange={setOpen}
        title="Start from a template"
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col gap-5 bg-paper p-5">
          {templates?.map((t) => (
            <div key={t.id} className="flex flex-col gap-2">
              <Text as="span" className={STAMP}>
                {t.name}
              </Text>
              <Text variant="hint" className="text-left">
                {t.description}
              </Text>
              <div>
                <Button
                  variant="primary"
                  size="compact"
                  // `t.id`, not a hardcoded template id — see the comment on
                  // `templates.list`.
                  onClick={() =>
                    void createFromTemplate({ templateId: t.id }).then(() => setOpen(false))
                  }
                >
                  Start this game
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ModalShell>
    </>
  )
}

function ConnectedGames() {
  const games = useQuery(api.games.listMine, {})
  const templates = useQuery(api.templates.list, {})
  const create = useMutation(api.games.create)
  const redeem = useMutation(api.invites.redeem)

  const navigate = useNavigate()

  const [newName, setNewName] = useState('')
  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinNotice, setJoinNotice] = useState<string | null>(null)

  const join = () => {
    setJoinError(null)
    setJoinNotice(null)
    void redeem({ code })
      .then((result) => {
        setCode('')
        if (result.kind === 'pending') {
          setJoinNotice('Asked to join. You will get in once the organizer approves.')
          return
        }
        void navigate({ to: '/games/$gameId', params: { gameId: result.gameId } })
      })
      // The server distinguishes not-valid / expired / revoked / used-up, so
      // surface its wording rather than a generic failure.
      .catch((err: Error) => setJoinError(err.message))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* CONTROLS BAND — the Roster's rhythm (`components/roster/Roster.tsx`):
          the things you can DO sit in one ink-ruled band across the top, and the
          things you HAVE list directly beneath it.

          This used to be three stacked Cards — start, template, join — so the
          games you came here to open were pushed below a screenful of forms you
          had already used. A lobby's subject is the list; creating is the
          control on it, not the other way round. */}
      <div className="flex flex-col gap-2.5 border-b-2 border-ink pb-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={STAMP}>Start a game</span>
            <input
              aria-label="New game name"
              placeholder="Union Crawler #430"
              className={INPUT}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <Button
            variant="primary"
            size="compact"
            disabled={newName.trim().length === 0}
            onClick={() => void create({ name: newName }).then(() => setNewName(''))}
          >
            Create
          </Button>

          <TemplatePicker templates={templates} />

          <label className="flex flex-col gap-1">
            <span className={STAMP}>Join with a code</span>
            <input
              aria-label="Invite code"
              placeholder="A1B2C3D4"
              className={`${INPUT} tracking-caps-wide uppercase`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <Button
            variant="primary"
            size="compact"
            disabled={code.trim().length === 0}
            onClick={join}
          >
            Join
          </Button>
        </div>

        {joinError !== null && (
          <Text variant="hint" className="text-left text-[var(--color-roll-cascade)]">
            {joinError}
          </Text>
        )}
        {joinNotice !== null && (
          <Text variant="hint" className="text-left">
            {joinNotice}
          </Text>
        )}
      </div>

      {games === undefined && <ConvexPending label="your games" />}
      {games?.length === 0 && (
        <EntityRow
          empty
          entityType="game"
          roleLabel="Game"
          message="You are not in any games yet — start one above, or join with a code from whoever set yours up."
        />
      )}
      {games !== undefined && games.length > 0 && (
        <ul className="flex list-none flex-col gap-2.5 p-0">
          {games.map((game) => (
            <li key={game._id}>
              <GameRow game={game} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GamesBody() {
  const { mode } = useConnection()

  if (mode === 'connected') return <ConnectedGames />

  if (mode === 'disconnected') {
    return (
      <Card>
        <div className="p-4">
          <Text>
            Your games are unreachable right now. Reconnect to see your crew or manage invites.
          </Text>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <Text>Games let several people share one crawler, with a Mediator running the table.</Text>
        <Text variant="hint" className="text-left">
          You are playing solo. Everything you build stays on this device and needs no account —
          sign in only if you want to play with other people.
        </Text>
        <div>
          <SignInControl />
        </div>
      </div>
    </Card>
  )
}

export function GamesScreen() {
  return (
    <main className={PAGE}>
      <Text as="h1" className="font-cond text-2xl font-bold tracking-caps uppercase">
        Games
      </Text>
      {isConvexConfigured ? (
        <GamesBody />
      ) : (
        <Card>
          <div className="p-4">
            <Text>
              This build has no account service configured, so shared games are unavailable and
              everything is saved on this device.
            </Text>
          </div>
        </Card>
      )}
    </main>
  )
}
