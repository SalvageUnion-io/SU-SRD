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
 * has no account on and a Disconnected session cannot write. The Games hooks
 * live in a child mounted only once the mode is Connected, so the signed-out
 * hub has no game UI at all.
 */

import { gamePath } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { FieldError } from '../../components/app'
import {
  Button,
  Field,
  Input,
  ModalShell,
  Pending,
  Segmented,
  SegmentedOption,
  SlabSection,
  Text,
  tokens,
} from '../../components/index'
import { useGo } from '../../components/shared/useGo'
import { useServerAction } from '../../lib/connection/useServerAction'
import { buildGamesCopy } from '../../messages/build-games'
import { TableNameField } from '../../play/games/TableNameField'
import { useTableName } from '../../play/games/useTableName'
import type { GameCallArgs, GameCallResult } from '../../replica/roomCalls'
import { useGamesCall, useGamesQuery } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'

type TemplateId = GameCallArgs<'templates.createGame'>['templateId']

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

type Template = NonNullable<GameCallResult<'templates.list'>>[number]

/**
 * One template, started under the dialog's one Game name (r8 C1, LG8-16): a
 * name typed there is the Game's whichever button starts it. Left as
 * suggested, the Game takes the campaign's short name (r6 C9), which the
 * section says, its crawler named on its own line.
 */
function TemplateStart({
  template,
  busy,
  named,
  onStart,
}: {
  template: Template
  busy: boolean
  /** A name was typed in the Game name field, so it is this Game's too. */
  named: boolean
  onStart: () => void
}) {
  return (
    <SlabSection as="h4" title={template.shortName} bodyStyle={STACK}>
      <Text variant="hint">{template.description}</Text>
      <div style={ROW}>
        <Button variant="default" size="full" disabled={busy} onClick={onStart}>
          {buildGamesCopy('startThisGame')}
        </Button>
      </div>
      <Text variant="hint">
        {buildGamesCopy('comesWithCrawler', { crawler: template.crawler })}
      </Text>
      {!named && (
        <Text variant="hint">
          {buildGamesCopy('templateNamedAs', { name: template.shortName })}
        </Text>
      )}
    </SlabSection>
  )
}

type NewGameDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Made for something already on screen (a move's "where to"): stay there, the new Game listed. */
  stay?: boolean
}

function ConnectedNewGameDialog({ open, onOpenChange, stay = false }: NewGameDialogProps) {
  // Read only while the dialog is open: the list is for choosing from, and a
  // subscription held for every visit to the hub would serve nobody.
  const templates = useGamesQuery('templates.list', open ? {} : 'skip')
  const create = useGamesCall('games.create')
  const createFromTemplate = useGamesCall('templates.createGame')
  // Most tables are started by whoever runs them, so Yes is the answer given.
  const [mediates, setMediates] = useState(true)
  const go = useGo()

  // The suggested name is a real value, so Create works from the start (r7 C15, LG7-04).
  const suggested = buildGamesCopy('unionCrawler430')
  const [name, setName] = useState(suggested)
  // One Game name for both ways to start (r8 C1): typed, it names a template's Game too.
  const named = name.trim() !== '' && name !== suggested
  // How the table will call its maker, asked here once and filled in (r7 C1).
  const you = useTableName()
  // Typing starts in the name, never on Close (MD2-04).
  const nameField = useRef<HTMLInputElement | null>(null)
  const start = useServerAction(
    // The creator is the Organiser, who appoints the Mediator: themselves, if they said so.
    async (from: { name: string } | { templateId: TemplateId; name: string }) => {
      await you.keep()
      return 'templateId' in from
        ? createFromTemplate({ ...from, mediator: mediates })
        : create({ ...from, mediator: mediates })
    },
    { failure: buildGamesCopy('gameNotCreated') }
  )
  const { pending: busy, error } = start

  // A dialog opened afresh shows no failure from the last time.
  const { clearError } = start
  useEffect(() => {
    if (open) clearError()
  }, [open, clearError])

  /** Open the new Game's own page; the dialog has done its job. */
  function enter(gameId: string) {
    if (!stay) go(gamePath(gameId))
    setName(suggested)
    onOpenChange(false)
  }

  async function startGame(from: { name: string } | { templateId: TemplateId; name: string }) {
    const result = await start.run(from)
    if (result.ok) enter(result.value)
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={buildGamesCopy('newGame')}
      initialFocus={nameField}
    >
      <div style={BODY}>
        <TableNameField name={you} />
        <div style={STACK}>
          <div style={ROW}>
            <Text variant="body">{buildGamesCopy('willYouBeTheMediator')}</Text>
            <Segmented label={buildGamesCopy('willYouBeTheMediator')} size="compact">
              <SegmentedOption pressed={mediates} onClick={() => setMediates(true)}>
                {buildGamesCopy('yes')}
              </SegmentedOption>
              <SegmentedOption pressed={!mediates} onClick={() => setMediates(false)}>
                {buildGamesCopy('no')}
              </SegmentedOption>
            </Segmented>
          </div>
          <Text variant="hint">{buildGamesCopy('organiserExplained')}</Text>
        </div>
        <SlabSection as="h3" id="new-game-start" title={buildGamesCopy('startAGame')}>
          <div style={ROW}>
            <div style={GROW}>
              <Field label={buildGamesCopy('gameName')}>
                <Input
                  ref={nameField}
                  aria-label={buildGamesCopy('newGameName')}
                  value={name}
                  // The suggestion goes as the first key is typed.
                  onFocus={(e) => e.currentTarget.select()}
                  // The room's cap on a Game's name (`rooms/game/roster.ts`).
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  // The cursor starts here, so Enter is Create (LG3-10).
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !busy && name.trim().length > 0) {
                      void startGame({ name })
                    }
                  }}
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
            <TemplateStart
              key={t.id}
              template={t}
              busy={busy}
              // `t.id`, not a hardcoded template id — see `templates.list`.
              named={named}
              onStart={() =>
                void startGame({ templateId: t.id, name: named ? name.trim() : t.shortName })
              }
            />
          ))}
        </SlabSection>

        <Text variant="hint">{buildGamesCopy('joiningAFriendsGameOpen')}</Text>

        <FieldError>{error}</FieldError>
      </div>
    </ModalShell>
  )
}

function ConnectedNewGameControl({ stay }: { stay: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* A make (+ New) is outlined wherever it stands (ruleset §3.14). */}
      <Button variant="default" size="compact" onClick={() => setOpen(true)}>
        {buildGamesCopy('newGame2')}
      </Button>
      <ConnectedNewGameDialog open={open} onOpenChange={setOpen} stay={stay} />
    </>
  )
}

/**
 * "+ New Game" and its dialog; nothing at all outside Connected mode. With
 * `stay` the new Game does not open: whoever asked (Move to a Game… with no
 * Game to move to, r4 E15) lists it and carries on.
 */
export function NewGameControl({ stay = false }: { stay?: boolean }) {
  const { status } = useSync()
  if (status !== 'live') return null
  return <ConnectedNewGameControl stay={stay} />
}
