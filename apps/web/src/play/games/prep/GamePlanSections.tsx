/**
 * The plan half of a Game's Prep (ADR-067 §4): the Mediator's notes for the
 * Game, and its session plans as a dated list, each with a private note. Nothing
 * here reaches a player: the plan is the table runner's alone (`plan.get`).
 *
 * Typing edits a draft that saves itself a moment after typing stops, when a
 * field is left and when the page is hidden or left (`usePlanDraft`), with a
 * 'Saved' sign by the field. Adding or removing a session saves at once, and
 * removing asks first (ADR-007). The sessions are
 * numbered and listed by day, and a session whose day changes takes its new
 * place only once its form is left, never under the cursor. A new session is
 * dated after the last, so it is added below it and numbered next.
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
import { useEffect, useId, useState } from 'react'
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
import { playGamesCopy } from '../../../messages/play-games'
import { useGamesQuery } from '../../../replica/roomCalls'
import {
  addSession,
  heldSessions,
  nextSessionDay,
  patchSession,
  removeSession,
  sessionName,
} from './gamePrep.model'
import type { PlanSaveSign } from './usePlanDraft'
import { usePlanDraft } from './usePlanDraft'

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
const ROW_END = {
  alignItems: 'center',
  display: 'flex',
  gap: space[12],
  justifyContent: 'flex-end',
} satisfies CSSProperties
/** The saved sign sits at the row's start, away from the button. */
const SIGN = { margin: 0, marginRight: 'auto' } satisfies CSSProperties

/** A save sign's words, each key said outright so the catalogue sees it. */
function signWords(state: PlanSaveSign['state']): string {
  if (state === 'saving') return playGamesCopy('planSaving')
  return state === 'saved' ? playGamesCopy('planSaved') : playGamesCopy('planNotSaved')
}

/** Whether what was last typed here is kept; said to a screen reader as it changes. */
function SaveSign({ sign, at }: { sign: PlanSaveSign | null; at: string }) {
  return (
    <p role="status" className={CAPS} style={SIGN}>
      {sign?.at === at ? signWords(sign.state) : ''}
    </p>
  )
}
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
  const { draft, sign, edit, write, replace, flush, save } = usePlanDraft(gameId)
  const plan: GamePlan = draft ?? kept ?? EMPTY_GAME_PLAN
  const loading = kept === undefined && draft === null
  const leave = () => flush()
  // The order the list last settled in: a new day waits for the form to be left.
  const [held, setHeld] = useState<string[] | null>(null)
  const sessions = heldSessions(plan, held)
  const hold = () => setHeld(sessions.map((session) => session.id))
  const settle = () => setHeld(null)
  // A session just added, brought into view: on a phone its form lands off screen (MD3-07).
  const [added, setAdded] = useState<string | null>(null)
  useEffect(() => {
    if (added !== null) {
      document.getElementById(`${id}-${added}`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [added, id])

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
            onChange={(e) => edit({ ...plan, notes: e.target.value }, 'notes')}
            onBlur={leave}
          />
        </Field>
        <SaveSign sign={sign} at="notes" />
        <Text variant="hint">{playGamesCopy('onlyYouSeeThis')}</Text>
      </SlabSection>
      <SlabSection
        as="h2"
        id="game-sessions-heading"
        title={playGamesCopy('sessions')}
        count={sessions.length}
      >
        <Text variant="note">{playGamesCopy('sessionPlansNote')}</Text>
        <ul style={SESSIONS} aria-label={playGamesCopy('sessions')}>
          {sessions.map((session, at) => (
            <li
              key={session.id}
              id={`${id}-${session.id}`}
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
                        edit(patchSession(plan, session.id, { date: e.target.value }), session.id)
                      }
                      onBlur={leave}
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
                        edit(patchSession(plan, session.id, { title: e.target.value }), session.id)
                      }
                      onBlur={leave}
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
                    edit(patchSession(plan, session.id, { note: e.target.value }), session.id)
                  }
                  onBlur={leave}
                />
              </Field>
              <div style={ROW_END}>
                <SaveSign sign={sign} at={session.id} />
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
                        replace(next)
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
            onClick={() => {
              const session = crypto.randomUUID()
              write(addSession(plan, session, nextSessionDay(plan, todayDay())))
              setAdded(session)
            }}
          >
            {playGamesCopy('addSession')}
          </Button>
        </div>
      </SlabSection>
    </>
  )
}
