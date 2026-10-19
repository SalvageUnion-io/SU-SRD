import { CardControlRail } from '../../containers/CardControlRail'
import { SelectedSeal } from '../../entity/modes/select'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'

/**
 * The top-right rail. It lives at the Card layer (`CardControlRail`) — this
 * card inherits it. The selection seal rides in as a `seal` because it carries
 * bespoke tone styling the control variants don't cover; the action
 * cells come through `controls`. A card's condition is not here: it is the
 * body's `StatusRail`.
 */
export function CardTopRail({
  controls,
  selected,
  selectionSeal,
}: {
  controls: ReferenceEntityControl[] | undefined
  selected: boolean | undefined
  selectionSeal: string | undefined
}) {
  // Selection seal — select mode's ink seal (EDL Modes: "ink ring and
  // 'Selected' seal"; §3.3: a state is a treatment, not a hue): a selected
  // Card always wears it, "Selected" unless the caller names its own word
  // (hard rule R15). A Token (level 2) draws no rail, so it is ring only.
  const selectionSealNode = selected ? <SelectedSeal word={selectionSeal} /> : null
  return <CardControlRail controls={controls} seals={[selectionSealNode]} />
}
