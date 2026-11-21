/**
 * The plan half of a Game's Prep (ADR-067 §4): the Mediator's notes for the
 * Game, and its sessions as a dated list, each with a private note. Nothing
 * here reaches a player: the plan is the table runner's alone (`plan.get`).
 *
 * Typing edits a draft; leaving a field saves it. Adding or removing a
 * session saves at once, and removing asks first (ADR-007). The sessions are
 * numbered and listed by day, and a session whose day changes takes its new
 * place only once its form is left, never under the cursor.
 */

import type { GamePlan } from 'game-domain/schemas/gamePlan'
import {
  EMPTY_GAME_PLAN,
  GAME_PLAN_MAX_NOTES,
  GAME_PLAN_MAX_SESSION_NOTE,
  GAME_PLAN_MAX_SESSIONS,
  GAME_PLAN_MAX_TITLE,
} from 'game-domain/schemas/gamePlan'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import {
  Button,
  capsLabel,
  Field,
  Input,
  SlabSection,
  Text,
  Textarea,
  tokens,
} from '../../../components/index'
import type { Confirm } from '../../../components/shared/useConfirm'
import { todayDay } from '../../../lib/formatDate'
import { runWrite } from '../../../lib/runWrite'
import { playGamesCopy } from '../../../messages/play-games'
import { useGamesCall, useGamesQuery } from '../../../replica/roomCalls'
import {
  addSession,
  heldSessions,
  patchSession,
  removeSession,
  sessionName,
} from './gamePrep.model'

const { space } = tokens

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel()

const SESSIONS = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const SESSION = {
  borderTop: `${tokens.borderWidth.hairline} solid ${tokens.color.ink20}`,
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  paddingTop: space[12],
} satisfies CSSProperties

/** The day and the title share a line where there is room, the day never wider than a date. */
const SESSION_HEAD = { display: 'flex', flexWrap: 'wrap', gap: space[12] } satisfies CSSProperties
const DAY = { flex: '0 1 11rem' } satisfies CSSProperties
const TITLE = { flex: '1 1 14rem' } satisfies CSSProperties
const ROW_END = { display: 'flex', justifyContent: 'flex-end' } satisfies CSSProperties
const ADD = { display: 'flex' } satisfies CSSProperties
/** A session's number, a caps label over its form. */
const NUMBER = { margin: 0 } satisfies CSSProperties

export function GamePlanSections({
  gameId,
  canWrite,
  confirm,
}: {
  gameId: string
  canWrite: boolean
  confirm: Confirm
}) {
  const id = useId()
  const kept = useGamesQuery('plan.get', { gameId })
  const save = useGamesCall('plan.set', { gameId })
  // What the Mediator has typed since the plan arrived; it wins over the kept copy.
  const [draft, setDraft] = useState<GamePlan | null>(null)
  const plan = draft ?? kept ?? EMPTY_GAME_PLAN
  const loading = kept === undefined && draft === null

  /** Save what is typed, when a field is left. */
  const flush = () => {
    if (draft !== null) runWrite(() => save({ plan: draft }))
  }
  /** A change that is whole at once: kept at once. */
  const write = (next: GamePlan) => {
    setDraft(next)
    runWrite(() => save({ plan: next }))
  }
  // The order the list last settled in: a new day waits for the form to be left.
  const [held, setHeld] = useState<string[] | null>(null)
  const sessions = heldSessions(plan, held)
  const hold = () => setHeld(sessions.map((session) => session.id))
  const settle = () => setHeld(null)

  return (
    <>
      <SlabSection as="h2" id="game-notes-heading" title={playGamesCopy('gameNotes')}>
        <Field label={playGamesCopy('gameNotesLabel')} htmlFor={`${id}-notes`}>
          <Textarea
            id={`${id}-notes`}
            rows={6}
            value={plan.notes}
            maxLength={GAME_PLAN_MAX_NOTES}
            disabled={!canWrite || loading}
            onChange={(e) => setDraft({ ...plan, notes: e.target.value })}
            onBlur={flush}
          />
        </Field>
        <Text variant="hint">{playGamesCopy('onlyYouSeeThis')}</Text>
      </SlabSection>
      <SlabSection
        as="h2"
        id="game-sessions-heading"
        title={playGamesCopy('sessions')}
        count={sessions.length}
      >
        {sessions.length === 0 && !loading && (
          <Text variant="note">{playGamesCopy('noSessionsYet')}</Text>
        )}
        <ul style={SESSIONS} aria-label={playGamesCopy('sessions')}>
          {sessions.map((session, at) => (
            <li
              key={session.id}
              style={SESSION}
              // Hold the order while this form has the cursor; sort again on leaving it.
              onFocus={hold}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) settle()
              }}
            >
              <h3 className={CAPS} style={NUMBER}>
                {playGamesCopy('sessionNumber', { n: at + 1 })}
              </h3>
              <div style={SESSION_HEAD}>
                <div style={DAY}>
                  <Field label={playGamesCopy('sessionDay')} htmlFor={`${id}-${session.id}-day`}>
                    <Input
                      id={`${id}-${session.id}-day`}
                      type="date"
                      value={session.date ?? ''}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setDraft(patchSession(plan, session.id, { date: e.target.value }))
                      }
                      onBlur={flush}
                    />
                  </Field>
                </div>
                <div style={TITLE}>
                  <Field
                    label={playGamesCopy('sessionTitle')}
                    htmlFor={`${id}-${session.id}-title`}
                  >
                    <Input
                      id={`${id}-${session.id}-title`}
                      value={session.title ?? ''}
                      maxLength={GAME_PLAN_MAX_TITLE}
                      autoComplete="off"
                      disabled={!canWrite}
                      onChange={(e) =>
                        setDraft(patchSession(plan, session.id, { title: e.target.value }))
                      }
                      onBlur={flush}
                    />
                  </Field>
                </div>
              </div>
              <Field
                label={playGamesCopy('sessionPrivateNote')}
                htmlFor={`${id}-${session.id}-note`}
              >
                <Textarea
                  id={`${id}-${session.id}-note`}
                  rows={3}
                  value={session.note}
                  maxLength={GAME_PLAN_MAX_SESSION_NOTE}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setDraft(patchSession(plan, session.id, { note: e.target.value }))
                  }
                  onBlur={flush}
                />
              </Field>
              <div style={ROW_END}>
                <Button
                  variant="ghost"
                  size="mini"
                  disabled={!canWrite}
                  aria-label={playGamesCopy('removeSessionNamed', { name: sessionName(session) })}
                  onClick={() =>
                    confirm({
                      title: playGamesCopy('removeSessionTitle', { name: sessionName(session) }),
                      body: [playGamesCopy('removeSessionBody')],
                      confirmLabel: playGamesCopy('remove'),
                      pendingLabel: playGamesCopy('removing'),
                      failure: playGamesCopy('couldNotLeave'),
                      tone: 'danger',
                      onConfirm: async () => {
                        const next = removeSession(plan, session.id)
                        setDraft(next)
                        await save({ plan: next })
                      },
                    })
                  }
                >
                  {playGamesCopy('removeSession')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div style={ADD}>
          <Button
            size="compact"
            disabled={!canWrite || loading || plan.sessions.length >= GAME_PLAN_MAX_SESSIONS}
            onClick={() => write(addSession(plan, crypto.randomUUID(), todayDay()))}
          >
            {playGamesCopy('addSession')}
          </Button>
        </div>
      </SlabSection>
    </>
  )
}
