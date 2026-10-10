/**
 * ProposeDock — "Propose a change · the player decides", the right half of the
 * Mediator Dashboard's display, under every tab (board M1;
 * docs/architecture/mediator-dashboard.md Q8).
 *
 * Target, Field, To, an optional Reason (at most 140 characters), a live
 * preview ("SP 6 → 4 · "Rifle Squad volley""), **Propose**, and the three
 * newest proposals with their state. The preview is the one place a before
 * shows: a sent proposal stores none (ADR-030 §4 as amended for issue 1130).
 *
 * Targets are claimed pilots and mechs; a mech is labelled by its pilot
 * ("Pickle's Spectrum"). The value is a whole number from 0 to the field's
 * derived maximum, clamped here; `proposals.apply` still parses it on the
 * server. Tapping a seat card picks its pilot and moves focus to To.
 *
 * Presentational: the Dashboard owns the target (a seat card sets it) and the
 * write.
 */

import { Button, Field, Input, Select, tokens } from 'component-lib'
import type { CSSProperties, RefObject } from 'react'
import { useId, useState } from 'react'
import type { ProposalField, ProposalTarget } from '../../lib/games/proposals'
import {
  clampProposalValue,
  fieldLabel,
  PROPOSAL_FIELDS,
  PROPOSAL_REASON_MAX,
  PROPOSAL_STATE_WORD,
} from '../../lib/games/proposals'
import { EYEBROW, MUTED, NUMBERS, VISUALLY_HIDDEN } from './mediatorStyles'
import { ProposalRow } from './ProposalRow'
import type { SentProposal } from './proposalLine'
import { PROPOSAL_LIST } from './proposalLine'

const { color, space } = tokens

export type ProposeArgs = {
  entityId: string
  entityType: 'pilot' | 'mech'
  field: ProposalField
  after: number
  reason?: string
}

const DOCK: CSSProperties = {
  height: '100%',
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  padding: space[12],
  background: color.wkBg,
}

const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(4.5rem, 0.5fr)',
  gap: space[8],
  alignItems: 'end',
}

const SEND_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[12],
}

const PREVIEW: CSSProperties = { ...MUTED, ...NUMBERS, minWidth: 0 }

export function ProposeDock({
  targets,
  targetId,
  onTarget,
  recent,
  now,
  canWrite,
  onPropose,
  toRef,
}: {
  targets: readonly ProposalTarget[]
  targetId: string | null
  onTarget: (id: string | null) => void
  /** The three newest proposals in the Game. */
  recent: readonly SentProposal[]
  now: number
  canWrite: boolean
  /** Resolves when the server has the proposal; rejects with its refusal. */
  onPropose: (args: ProposeArgs) => Promise<void>
  /** The To field, which picking a seat card focuses. */
  toRef: RefObject<HTMLInputElement | null>
}) {
  const id = useId()
  const target = targets.find((t) => t.id === targetId) ?? null
  const fields = target === null ? PROPOSAL_FIELDS.pilot : PROPOSAL_FIELDS[target.kind]
  const [chosenField, setChosenField] = useState<ProposalField>(fields[0].field)
  // A target of the other kind has none of this one's fields: fall back to its first.
  const field: ProposalField = fields.some((f) => f.field === chosenField)
    ? chosenField
    : fields[0].field
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)

  const reading = target?.readings[field]
  const max = reading?.max ?? null
  const value = clampProposalValue(to, max)
  const trimmed = reason.trim()
  const before = reading?.current ?? null
  const preview =
    target === null || value === null
      ? 'Pick a seat or a target, then the value you think it should be.'
      : [
          `${target.label}: ${fieldLabel(field)} ${before ?? '—'} → ${value}`,
          trimmed === '' ? null : `“${trimmed}”`,
        ]
          .filter((part) => part !== null)
          .join(' · ')

  const send = () => {
    if (target === null || value === null) return
    setSending(true)
    void onPropose({
      entityId: target.id,
      entityType: target.kind,
      field,
      after: value,
      ...(trimmed === '' ? {} : { reason: trimmed }),
    })
      .then(() => {
        setTo('')
        setReason('')
      })
      // The caller has already said why; the form keeps what was typed.
      .catch(() => undefined)
      .finally(() => setSending(false))
  }

  return (
    <section aria-labelledby={`${id}-heading`} style={DOCK}>
      <h2 id={`${id}-heading`} style={EYEBROW}>
        Propose a change · the player decides
      </h2>
      <div style={ROW}>
        <Field label="Target" htmlFor={`${id}-target`}>
          <Select
            id={`${id}-target`}
            value={targetId ?? ''}
            disabled={!canWrite}
            onChange={(e) => onTarget(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Choose…</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Field" htmlFor={`${id}-field`}>
          <Select
            id={`${id}-field`}
            value={field}
            disabled={!canWrite}
            onChange={(e) => setChosenField(e.target.value as ProposalField)}
          >
            {fields.map((f) => (
              <option key={f.field} value={f.field}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="To" htmlFor={`${id}-to`}>
          <Input
            ref={toRef}
            id={`${id}-to`}
            inputMode="numeric"
            value={to}
            disabled={!canWrite}
            aria-describedby={`${id}-preview`}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Reason (optional)" htmlFor={`${id}-reason`}>
        <Input
          id={`${id}-reason`}
          value={reason}
          maxLength={PROPOSAL_REASON_MAX}
          placeholder="Rifle Squad volley"
          disabled={!canWrite}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <div style={SEND_ROW}>
        <p id={`${id}-preview`} style={PREVIEW}>
          {preview}
          {max !== null && value !== null && Number(to) > max ? ` (at most ${max})` : ''}
        </p>
        <Button
          variant="primary"
          size="compact"
          disabled={!canWrite || target === null || value === null || sending}
          onClick={send}
        >
          Propose
        </Button>
      </div>
      {recent.length > 0 && (
        <section aria-label="Newest proposals">
          <span style={VISUALLY_HIDDEN} role="status" aria-live="polite">
            {recent[0] ? `Newest proposal: ${PROPOSAL_STATE_WORD[recent[0].state]}` : ''}
          </span>
          <ul style={PROPOSAL_LIST}>
            {recent.map((p) => (
              <ProposalRow key={p._id} proposal={p} now={now} showTime={false} />
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
