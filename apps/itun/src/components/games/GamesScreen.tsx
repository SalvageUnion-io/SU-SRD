import { useState } from 'react'
import { Button, Card, EntityRow, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'

import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { SignInControl } from '../account/SignInControl'
import { GameRow } from './GameRow'
import { STAMP } from './gameChrome'

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

function ConnectedGames() {
  const games = useQuery(api.games.listMine, {})
  const templates = useQuery(api.templates.list, {})
  const create = useMutation(api.games.create)
  const createFromTemplate = useMutation(api.templates.createGame)
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
      <Card>
        <div className="flex flex-wrap items-end gap-2 p-4">
          <label className="flex flex-col gap-1">
            <span className={STAMP}>Start a game</span>
            <input
              aria-label="New game name"
              placeholder="Union Crawler #430"
              className="border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-1"
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
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 p-4">
          <span className={STAMP}>Or start from a template</span>
          {templates?.map((t) => (
            <div key={t.id} className="flex flex-col gap-2">
              <Text as="span">{t.name}</Text>
              <Text variant="hint" className="text-left">
                {t.description}
              </Text>
              <div>
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={() =>
                    void createFromTemplate({
                      templateId: 'starter-set',
                      name: newName || undefined,
                    })
                  }
                >
                  Start this game
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className={STAMP}>Join with a code</span>
              <input
                aria-label="Invite code"
                placeholder="A1B2C3D4"
                className="border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-1 tracking-caps-wide uppercase"
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
      </Card>

      {games === undefined && <Text>Loading your games…</Text>}
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
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
