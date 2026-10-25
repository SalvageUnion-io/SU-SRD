/**
 * "+ New Game" — the way to start a Game (ADR-030): a button on the Play hub
 * (ADR-052 §4), never in Build.
 *
 * One dialog with two ways to start a table: by name, or from a template.
 * Joining somebody else's Game is not here: a Game is joined from an invite
 * link, never a typed code, so this dialog has no code door. The link opens `/play/invite/$token`, which does the joining.
 *
 * A new Game opens on its own page in Play (`/play/games/$gameId`) as the
 * dialog closes, so the next thing on screen is the new table.
 *
 * ## Connected only
 *
 * A Game is shared state on the server of record, which a signed-out visitor
 * has no account on and a Disconnected session cannot write. The Convex hooks
 * live in a child mounted only once the mode is Connected, so the signed-out
 * hub has no game UI at all.
 */

import { useMutation, useQuery } from 'convex/react'
import type { FunctionArgs } from 'convex/server'
import { gamePath } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  Button,
  Field,
  FieldError,
  Input,
  ModalShell,
  Pending,
  SlabSection,
  Text,
  tokens,
} from '../../components/index'
import { useGo } from '../../components/shared/useGo'
import { useServerAction } from '../../lib/connection/useServerAction'
import { buildGamesCopy } from '../../messages/build-games'
import { useSync } from '../../replica/syncContext'

type TemplateId = FunctionArgs<typeof api.templates.createGame>['templateId']

const BODY = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
  padding: tokens.space[20],
} satisfies CSSProperties

/** A section's body: what it holds, one gap apart. */
const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

/** A field and its button on one line, wrapping on a phone. */
const ROW = {
  alignItems: 'flex-end',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
} satisfies CSSProperties

const GROW = { flex: '1 1 12rem', minWidth: 0 } satisfies CSSProperties

const HINT = { textAlign: 'left' } satisfies CSSProperties

type NewGameDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ConnectedNewGameDialog({ open, onOpenChange }: NewGameDialogProps) {
  // Read only while the dialog is open: the list is for choosing from, and a
  // subscription held for every visit to the hub would serve nobody.
  const templates = useQuery(api.templates.list, open ? {} : 'skip')
  const create = useMutation(api.games.create)
  const createFromTemplate = useMutation(api.templates.createGame)
  const go = useGo()

  const [name, setName] = useState('')
  const start = useServerAction(
    (from: { name: string } | { templateId: TemplateId }) =>
      'templateId' in from ? createFromTemplate(from) : create(from),
    { failure: 'That Game could not be created. Try again.' }
  )
  const { pending: busy, error } = start

  // A dialog opened afresh shows no failure from the last time.
  const { clearError } = start
  useEffect(() => {
    if (open) clearError()
  }, [open, clearError])

  /** Open the new Game's own page; the dialog has done its job. */
  function enter(gameId: string) {
    go(gamePath(gameId))
    setName('')
    onOpenChange(false)
  }

  async function startGame(from: { name: string } | { templateId: TemplateId }) {
    const result = await start.run(from)
    if (result.ok) enter(result.value)
  }

  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={buildGamesCopy('newGame')}>
      <div style={BODY}>
        <SlabSection as="h3" id="new-game-start" title={buildGamesCopy('startAGame')}>
          <div style={ROW}>
            <div style={GROW}>
              <Field label={buildGamesCopy('name')}>
                <Input
                  aria-label={buildGamesCopy('newGameName')}
                  placeholder={buildGamesCopy('unionCrawler430')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </div>
            <Button
              variant="primary"
              size="full"
              disabled={busy || name.trim().length === 0}
              onClick={() => void startGame({ name })}
            >
              {buildGamesCopy('create')}
            </Button>
          </div>
        </SlabSection>

        <SlabSection
          as="h3"
          id="new-game-template"
          title={buildGamesCopy('fromATemplate')}
          bodyStyle={STACK}
        >
          {templates === undefined && <Pending label="templates" />}
          {templates?.map((t) => (
            <SlabSection as="h4" title={t.name} key={t.id} bodyStyle={STACK}>
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
                  {buildGamesCopy('startThisGame')}
                </Button>
              </div>
            </SlabSection>
          ))}
        </SlabSection>

        <Text variant="hint" style={HINT}>
          {buildGamesCopy('joiningAFriendsGameOpen')}
        </Text>

        <FieldError>{error}</FieldError>
      </div>
    </ModalShell>
  )
}

function ConnectedNewGameControl() {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* A make, so rust (ruleset §1.9). */}
      <Button variant="primary" size="mini" onClick={() => setOpen(true)}>
        {buildGamesCopy('newGame2')}
      </Button>
      <ConnectedNewGameDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

/** "+ New Game" and its dialog; nothing at all outside Connected mode. */
export function NewGameControl() {
  const { status } = useSync()
  if (status !== 'live') return null
  return <ConnectedNewGameControl />
}
