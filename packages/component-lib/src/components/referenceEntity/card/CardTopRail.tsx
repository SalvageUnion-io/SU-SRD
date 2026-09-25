import { Badge } from '../../chrome/Badge'
import { CountStepper } from '../../chrome/CountStepper'
import { CardControlRail } from '../../shared/CardControlRail'
import type { EntityStatus } from '../../shared/entityStatus'
import { foldStatusControl } from '../../shared/foldStatusControl'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'

/**
 * The top-right rail. It lives at the Card layer (`CardControlRail`) — this
 * card inherits it. Selection and multi-select seals ride in as `seals` because
 * they carry bespoke tone styling the control variants don't cover; the status
 * and action cells come through `controls`.
 *
 * Condition is routed into the rail as a status CONTROL rather than a bespoke
 * seal, via the same `foldStatusControl` the Card shell uses, so the badge (and
 * the fold rule) has one implementation across both card layers.
 *
 * (There was a `label` CALLOUT on the card — a second mini stamp at `left-3
 * z-30`, straddling the same top-left corner as the seam at `left-[15px] z-10`.
 * It is deleted, not merely unused. Every one of its four call sites passed the
 * ability's TREE, which the seam pill already states with the level
 * (`[Forging | 1]`), so the callout painted OVER the pill. Keeping the prop
 * around would leave a loaded gun: it has no non-duplicating use, and passing
 * it re-creates the collision.)
 */
export function CardTopRail({
  controls,
  status,
  onStatusClick,
  subject,
  compact,
  selected,
  selectionSeal,
  multiSelect,
}: {
  controls: ReferenceEntityControl[] | undefined
  status: EntityStatus | undefined
  onStatusClick: (() => void) | undefined
  /** Names the status control ("Mark {subject} damaged"). */
  subject: string
  compact: boolean
  selected: boolean | undefined
  selectionSeal: string | undefined
  /** Present on a MULTI-SELECT cell (`onCountChange` set). */
  multiSelect: { count: number; onChange: (next: number) => void; subject: string } | undefined
}) {
  const railControls = foldStatusControl(controls, status, { onClick: onStatusClick, subject })
  // Selection seal — an `ok`-tone "chosen" stamp riding the top-right frame when
  // selected (the picker-cell affordance formerly overlaid by SelCard).
  const selectionSealNode =
    selected && selectionSeal ? (
      <Badge surface="tone" tone="ok" className="pointer-events-none">{`${selectionSeal} ✓`}</Badge>
    ) : null
  // MULTI-SELECT seal — a "Chosen" stamp + `[− n +]` CountStepper, the
  // duplicate-allowed counterpart to the single-select seal. The "Chosen"
  // stamp only lights once at least one copy is picked.
  const countSealNode = multiSelect ? (
    <div className="flex items-center gap-1.5">
      {multiSelect.count >= 1 && (
        <Badge surface="tone" tone="ok">
          Chosen
        </Badge>
      )}
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
      compact={compact}
      seals={[selectionSealNode, countSealNode]}
    />
  )
}
