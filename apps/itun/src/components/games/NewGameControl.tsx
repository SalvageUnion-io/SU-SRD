/**
 * "+ New game" and "Join game" — the top of the hub, and every way into a Game
 * (ADR-030).
 *
 * Two buttons over one dialog. "+ New game" opens its two ways to start a
 * table: by name, or from a template. "Join game" opens the third door, an
 * invite code, on its own: a player who was handed a code is not starting a
 * game, and looking for "join" inside "new" was the wrong place to send them.
 * One dialog rather than two because the doors share their busy, error and
 * notice state, and only one is ever open.
 *
 * Whatever the door, a Game you are now in becomes what the hub shows: create
 * and join both set the active container to it and close the dialog, so the
 * next thing on screen is the new table. A join that needs the organizer's
 * approval does neither — there is no table to show yet — and says so.
 *
 * ## Connected only
 *
 * A Game is shared state on the server of record, which a signed-out visitor
 * has no account on and a Disconnected session cannot write. Like
 * `ContainerSwitcher`, the Convex hooks live in a child mounted only once the
 * mode is Connected, so the signed-out hub has no game UI at all.
 */

import { Button, Field, Input, ModalShell, PageHeading, Text, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionArgs } from 'convex/server'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { setActiveContainer } from '../../stores/activeContainerStore'
import { failureMessage } from '../shared/useConfirm'

type TemplateId = FunctionArgs<typeof api.templates.createGame>['templateId']

const BODY = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
  padding: tokens.space[20],
} satisfies CSSProperties

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[10],
} satisfies CSSProperties

/** Each door after the first sits under a hairline rule. */
const RULED = {
  ...SECTION,
  borderTop: `${tokens.borderWidth.hairline} solid ${tokens.color.ink15}`,
  paddingTop: tokens.space[20],
} satisfies CSSProperties

/** A field and its button on one line, wrapping on a phone. */
const ROW = {
  alignItems: 'flex-end',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
  paddingTop: tokens.space[8],
} satisfies CSSProperties

const GROW = { flex: '1 1 12rem', minWidth: 0 } satisfies CSSProperties

const HINT = { textAlign: 'left' } satisfies CSSProperties

const ERROR = { ...HINT, color: tokens.color.rollCascade } satisfies CSSProperties

const CODE = {
  letterSpacing: tokens.tracking.capsWide,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** Which door the dialog is showing; `null` while it is closed. */
type Door = 'new' | 'join'

function ConnectedNewGameControl() {
  const [door, setDoor] = useState<Door | null>(null)
  const open = door !== null
  // Read only while the dialog is open: the list is for choosing from, and a
  // subscription held for every visit to the hub would serve nobody.
  const templates = useQuery(api.templates.list, open ? {} : 'skip')
  const create = useMutation(api.games.create)
  const createFromTemplate = useMutation(api.templates.createGame)
  const redeem = useMutation(api.invites.redeem)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function openDoor(next: Door | null) {
    setDoor(next)
    if (next !== null) {
      setError(null)
      setNotice(null)
    }
  }

  /** The hub shows the Game you are now in, and the dialog has done its job. */
  function enter(gameId: string) {
    setActiveContainer({ kind: 'game', gameId })
    setName('')
    setCode('')
    setDoor(null)
  }

  async function attempt(work: () => Promise<void>, failure: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await work()
    } catch (err) {
      // A refusal (a dead or used-up code, say) is worded by the server for
      // the player; anything else gets a plain line and a report.
      setError(failureMessage(err, failure))
    } finally {
      setBusy(false)
    }
  }

  const startNamed = () =>
    attempt(async () => {
      enter(await create({ name }))
    }, 'That game could not be created. Try again.')

  const startFromTemplate = (templateId: TemplateId) =>
    attempt(async () => {
      enter(await createFromTemplate({ templateId }))
    }, 'That game could not be created. Try again.')

  const join = () =>
    attempt(async () => {
      const result = await redeem({ code })
      if (result.kind === 'pending') {
        setCode('')
        setNotice('Asked to join. You will get in once the organizer approves.')
        return
      }
      enter(result.gameId)
    }, 'That code could not be used. Try again.')

  return (
    <>
      <Button variant="default" size="compact" onClick={() => openDoor('new')}>
        + New game
      </Button>
      <Button variant="default" size="compact" onClick={() => openDoor('join')}>
        Join game
      </Button>
      <ModalShell
        open={open}
        onOpenChange={(next) => openDoor(next ? (door ?? 'new') : null)}
        title={door === 'join' ? 'Join game' : 'New game'}
      >
        <div style={BODY}>
          {door === 'new' && (
            <>
              <section aria-labelledby="new-game-start" style={SECTION}>
                <PageHeading variant="section" as="h3" id="new-game-start">
                  Start a game
                </PageHeading>
                <div style={ROW}>
                  <div style={GROW}>
                    <Field label="Name">
                      <Input
                        aria-label="New game name"
                        placeholder="Union Crawler #430"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="primary"
                    size="compact"
                    disabled={busy || name.trim().length === 0}
                    onClick={() => void startNamed()}
                  >
                    Create
                  </Button>
                </div>
              </section>

              <section aria-labelledby="new-game-template" style={RULED}>
                <PageHeading variant="section" as="h3" id="new-game-template">
                  From a template
                </PageHeading>
                {templates === undefined && (
                  <Text variant="hint" style={HINT}>
                    Loading templates…
                  </Text>
                )}
                {templates?.map((t) => (
                  <div key={t.id} style={SECTION}>
                    <PageHeading variant="subheading" as="h4">
                      {t.name}
                    </PageHeading>
                    <Text variant="hint" style={HINT}>
                      {t.description}
                    </Text>
                    <div>
                      <Button
                        variant="default"
                        size="compact"
                        disabled={busy}
                        // `t.id`, not a hardcoded template id — see `templates.list`.
                        onClick={() => void startFromTemplate(t.id)}
                      >
                        Start this game
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}

          {door === 'join' && (
            <section aria-label="Join game" style={SECTION}>
              <Text variant="hint" style={HINT}>
                Enter the invite code whoever runs the table gave you.
              </Text>
              <div style={ROW}>
                <div style={GROW}>
                  <Field label="Code">
                    <Input
                      aria-label="Invite code"
                      placeholder="A1B2C3D4"
                      style={CODE}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </Field>
                </div>
                <Button
                  variant="primary"
                  size="compact"
                  disabled={busy || code.trim().length === 0}
                  onClick={() => void join()}
                >
                  Join
                </Button>
              </div>
            </section>
          )}

          {error !== null && (
            <Text variant="hint" role="alert" style={ERROR}>
              {error}
            </Text>
          )}
          {notice !== null && (
            <Text variant="hint" role="status" style={HINT}>
              {notice}
            </Text>
          )}
        </div>
      </ModalShell>
    </>
  )
}

/** "+ New game" and its dialog; nothing at all outside Connected mode. */
export function NewGameControl() {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedNewGameControl />
}
