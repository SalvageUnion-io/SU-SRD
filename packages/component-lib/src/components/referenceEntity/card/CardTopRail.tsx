import type { ReactNode } from 'react'
import { space } from '../../../design/tokens'
import { SelectedSeal } from '../../../entity/modes/select'
import { CountStepper } from '../../atoms/CountStepper'
import type { EntityStatus } from '../../atoms/entityStatus'
import { CardControlRail } from '../../containers/CardControlRail'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'

/**
 * The top-right rail. It lives at the Card layer (`CardControlRail`) — this
 * card inherits it. Selection and multi-select seals ride in as `seals` because
 * they carry bespoke tone styling the control variants don't cover; the status
 * and action cells come through `controls`.
 *
 * Condition is routed into the rail as a status CONTROL leading the caller's
 * controls, rather than a bespoke seal, so the condition badge has one
 * implementation: the rail's.
 */
export function CardTopRail({
  controls,
  status,
  onStatusClick,
  subject,
  selected,
  selectionSeal,
  multiSelect,
  statusSeal,
}: {
  controls: ReferenceEntityControl[] | undefined
  status: EntityStatus | undefined
  onStatusClick: (() => void) | undefined
  /** Names the status control ("Mark {subject} damaged"). */
  subject: string
  selected: boolean | undefined
  selectionSeal: string | undefined
  /** Present on a MULTI-SELECT cell (`onCountChange` set). */
  multiSelect: { count: number; onChange: (next: number) => void; subject: string } | undefined
  /** The condition as a neutral tri-state seal (a head row has no body rail). */
  statusSeal?: ReactNode
}) {
  const railControls: ReferenceEntityControl[] = status
    ? [
        { key: '__status', status: { value: status, onClick: onStatusClick, subject } },
        ...(controls ?? []),
      ]
    : (controls ?? [])
  // Selection seal — select mode's ink seal (EDL Modes: "ink ring and
  // 'Selected' seal"; §3.3: a state is a treatment, not a hue), in the
  // caller's word, when selected (the picker-cell affordance).
  const selectionSealNode = selected && selectionSeal ? <SelectedSeal word={selectionSeal} /> : null
  // MULTI-SELECT seal — a "Chosen" stamp + `[− n +]` CountStepper, the
  // duplicate-allowed counterpart to the single-select seal. The "Chosen"
  // stamp only lights once at least one copy is picked.
  const countSealNode = multiSelect ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[6] }}>
      {multiSelect.count >= 1 && <SelectedSeal word="Chosen" />}
      <CountStepper
        subject={multiSelect.subject}
        count={multiSelect.count}
        onChange={multiSelect.onChange}
      />
    </div>
  ) : null
  return (
    <CardControlRail
      controls={railControls}
      seals={[statusSeal, selectionSealNode, countSealNode]}
    />
  )
}
