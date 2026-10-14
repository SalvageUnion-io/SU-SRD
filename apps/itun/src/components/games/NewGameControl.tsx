/**
 * "+ New Game" — the top of the hub, and the way to start a Game (ADR-030).
 *
 * One dialog with two ways to start a table: by name, or from a template.
 * Joining somebody else's Game is not here: a Game is joined from an invite
 * link, never a typed code, so this dialog has no code door. The link opens `/invite/$token`, which does the joining.
 *
 * A new Game opens on its own page (`/games/$gameId`) as the dialog closes, so
 * the next thing on screen is the new table.
 *
 * ## Connected only
 *
 * A Game is shared state on the server of record, which a signed-out visitor
 * has no account on and a Disconnected session cannot write. Like
 * `ContainerSwitcher`, the Convex hooks live in a child mounted only once the
 * mode is Connected, so the signed-out hub has no game UI at all.
 */

import {
  Button,
  Field,
  FieldError,
  Input,
  ModalShell,
  PageHeading,
  Text,
  tokens,
} from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionArgs } from 'convex/server'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { useServerAction } from '../../lib/connection/useServerAction'
import { useShowContainer } from '../container/useShowContainer'

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

/** The template door sits under a hairline rule. */
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

type NewGameControlProps = {
  /** Extra classes for the trigger (the Shelves band's on-ink outline). */
  className?: string
}

function ConnectedNewGameControl({ className }: NewGameControlProps) {
  const [open, setOpen] = useState(false)
  // Read only while the dialog is open: the list is for choosing from, and a
  // subscription held for every visit to the hub would serve nobody.
  const templates = useQuery(api.templates.list, open ? {} : 'skip')
  const create = useMutation(api.games.create)
  const createFromTemplate = useMutation(api.templates.createGame)
  const showContainer = useShowContainer()

  const [name, setName] = useState('')
  const start = useServerAction(
    (from: { name: string } | { templateId: TemplateId }) =>
      'templateId' in from ? createFromTemplate(from) : create(from),
    { failure: 'That Game could not be created. Try again.' }
  )
  const { pending: busy, error } = start

  function openDialog(next: boolean) {
    setOpen(next)
    if (next) start.clearError()
  }

  /** Open the new Game's own page; the dialog has done its job. */
  function enter(gameId: string) {
    showContainer({ kind: 'game', gameId })
    setName('')
    setOpen(false)
  }

  async function startGame(from: { name: string } | { templateId: TemplateId }) {
    const result = await start.run(from)
    if (result.ok) enter(result.value)
  }

  return (
    <>
      <Button
        variant="default"
        size="compact"
        onClick={() => openDialog(true)}
        className={className}
      >
        + New Game
      </Button>
      <ModalShell open={open} onOpenChange={openDialog} title="New Game">
        <div style={BODY}>
          <section aria-labelledby="new-game-start" style={SECTION}>
            <PageHeading variant="section" as="h3" id="new-game-start">
              Start a Game
            </PageHeading>
            <div style={ROW}>
              <div style={GROW}>
                <Field label="Name">
                  <Input
                    aria-label="New Game name"
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
                onClick={() => void startGame({ name })}
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
                <PageHeading as="h4">{t.name}</PageHeading>
                <Text variant="hint" style={HINT}>
                  {t.description}
                </Text>
                <div>
                  <Button
                    variant="default"
                    size="compact"
                    disabled={busy}
                    // `t.id`, not a hardcoded template id — see `templates.list`.
                    onClick={() => void startGame({ templateId: t.id })}
                  >
                    Start this Game
                  </Button>
                </div>
              </div>
            ))}
          </section>

          <Text variant="hint" style={HINT}>
            Joining a friend’s Game? Open the invite link they sent you.
          </Text>

          <FieldError>{error}</FieldError>
        </div>
      </ModalShell>
    </>
  )
}

/** "+ New Game" and its dialog; nothing at all outside Connected mode. */
export function NewGameControl(props: NewGameControlProps) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedNewGameControl {...props} />
}
