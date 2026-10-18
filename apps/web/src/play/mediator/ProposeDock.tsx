/**
 * ProposeDock — "Propose a change" (the player decides), the Mediator's
 * Propose section in Play (play.md §10; docs/architecture/mediator-dashboard.md
 * Q8 for the fields).
 *
 * Target, Field, To, an optional Reason (at most 140 characters), a live
 * preview ("SP 6 → 4 · "Rifle Squad volley""), **Propose**, and the three
 * newest proposals with their state. The preview is the one place a before
 * shows: a sent proposal stores none (ADR-030 §4, as amended).
 *
 * Targets are claimed pilots and mechs; a mech is labelled by its pilot
 * ("Pickle's Spectrum"). The value is a whole number from 0 to the field's
 * derived maximum, clamped here; `proposals.apply` still parses it on the
 * server. Tapping a seat card picks its pilot and moves focus to To.
 *
 * A `TitledBox` filling its panel and scrolling its own body there
 * (`.su-dash-box`).
 *
 * Presentational: the Mediator's screen owns the target (a seat sets it) and
 * the write.
 */

import type { OwnableKind } from 'cantina-domain/entityKinds'
import type { ProposalField, ProposalTarget } from 'cantina-domain/games/proposals'
import {
  clampProposalValue,
  fieldLabel,
  PROPOSAL_FIELDS,
  PROPOSAL_REASON_MAX,
  PROPOSAL_STATE_WORD,
} from 'cantina-domain/games/proposals'
import type { CSSProperties, RefObject } from 'react'
import { useId, useState } from 'react'
import { Button, FeedList, Field, Input, Select, TitledBox, tokens } from '../../index'
import { MUTED, NUMBERS } from './mediatorStyles.model'
import { ProposalRow } from './ProposalRow'
import type { SentProposal } from './proposalLine.model'

const { space } = tokens

export type ProposeArgs = {
  entityId: string
  entityType: OwnableKind
  field: ProposalField
  after: number
  reason?: string
}

const ROW = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(4.5rem, 0.5fr)',
  gap: space[8],
  alignItems: 'end',
} satisfies CSSProperties

const SEND_ROW = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[12],
} satisfies CSSProperties

const PREVIEW = { ...MUTED, ...NUMBERS, minWidth: 0 } satisfies CSSProperties

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
    <TitledBox as="section" title="Propose a change" titleAs="h2" className="su-dash-box">
      <p style={MUTED}>The player decides.</p>
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
          size="full"
          disabled={!canWrite || target === null || value === null || sending}
          onClick={send}
        >
          Propose
        </Button>
      </div>
      {recent.length > 0 && (
        <section aria-label="Newest proposals">
          <span className="su-sr-only" role="status" aria-live="polite">
            {recent[0] ? `Newest proposal: ${PROPOSAL_STATE_WORD[recent[0].state]}` : ''}
          </span>
          <FeedList>
            {recent.map((p) => (
              <ProposalRow key={p._id} proposal={p} now={now} showTime={false} />
            ))}
          </FeedList>
        </section>
      )}
    </TitledBox>
  )
}
