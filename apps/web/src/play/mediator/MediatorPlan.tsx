/**
 * MediatorPlan — the Mediator's plan at the table (r6 B7, MD6-09): the
 * session being played (`currentSession`) with its private note, then the
 * Game notes, both from Prep and editable in place. They save as Prep's do
 * (`usePlanDraft`: a moment after typing stops, on leaving a field, when the
 * page is hidden), with the same Saved sign, so the plan is read and kept
 * without leaving Mediate. From `lg` it is a pane of the end column; on a
 * phone the bar's ⋯ opens it. Loaded only when shown (`lazy`).
 */

import {
  EMPTY_GAME_PLAN,
  GAME_PLAN_MAX_NOTES,
  GAME_PLAN_MAX_SESSION_NOTE,
} from 'game-domain/schemas/gamePlan'
import type { CSSProperties } from 'react'
import { useId } from 'react'
import {
  Button,
  capsLabel,
  Field,
  SlabSection,
  Text,
  Textarea,
  tokens,
} from '../../components/index'
import { todayDay } from '../../lib/formatDate'
import { playGamesCopy } from '../../messages/play-games'
import { mediatorCopy } from '../../messages/play-mediator'
import { useGamesQuery } from '../../replica/roomCalls'
import { gamePrepPath, patchSession, sessionName } from '../games/prep/gamePrep.model'
import type { PlanSaveSign } from '../games/prep/usePlanDraft'
import { usePlanDraft } from '../games/prep/usePlanDraft'
import { currentSession } from './mediatorPlan.model'

const CAPS = capsLabel()
const SIGN = { margin: 0 } satisfies CSSProperties
const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

/** A save sign's words, each key said outright so the catalogue sees it. */
function signWords(state: PlanSaveSign['state']): string {
  if (state === 'saving') return playGamesCopy('planSaving')
  return state === 'saved' ? playGamesCopy('planSaved') : playGamesCopy('planNotSaved')
}

function SaveSign({ sign, at }: { sign: PlanSaveSign | null; at: string }) {
  return (
    <p role="status" className={CAPS} style={SIGN}>
      {sign?.at === at ? signWords(sign.state) : ''}
    </p>
  )
}

export function MediatorPlan({ gameId, canWrite }: { gameId: string; canWrite: boolean }) {
  const id = useId()
  const kept = useGamesQuery('plan.get', { gameId })
  const { draft, sign, edit, flush } = usePlanDraft(gameId)
  const plan = draft ?? kept ?? EMPTY_GAME_PLAN
  const loading = kept === undefined && draft === null
  const session = currentSession(plan, todayDay())
  const leave = () => flush()
  return (
    <SlabSection
      as="h2"
      id="mediate-plan"
      title={mediatorCopy('plan')}
      actions={
        <Button size="mini" href={gamePrepPath(gameId)}>
          {mediatorCopy('openPrep')}
        </Button>
      }
    >
      <div style={STACK}>
        {session === null ? (
          <Text variant="note">{mediatorCopy('noSessionPlanned')}</Text>
        ) : (
          <>
            <Field
              label={mediatorCopy('sessionPlanOf', { name: sessionName(session) })}
              htmlFor={`${id}-session`}
            >
              <Textarea
                id={`${id}-session`}
                rows={4}
                value={session.note}
                maxLength={GAME_PLAN_MAX_SESSION_NOTE}
                disabled={!canWrite || loading}
                onChange={(e) =>
                  edit(patchSession(plan, session.id, { note: e.target.value }), session.id)
                }
                onBlur={leave}
              />
            </Field>
            <SaveSign sign={sign} at={session.id} />
          </>
        )}
        <Field label={playGamesCopy('gameNotes')} htmlFor={`${id}-notes`}>
          <Textarea
            id={`${id}-notes`}
            rows={4}
            value={plan.notes}
            maxLength={GAME_PLAN_MAX_NOTES}
            disabled={!canWrite || loading}
            onChange={(e) => edit({ ...plan, notes: e.target.value }, 'notes')}
            onBlur={leave}
          />
        </Field>
        <SaveSign sign={sign} at="notes" />
      </div>
    </SlabSection>
  )
}
