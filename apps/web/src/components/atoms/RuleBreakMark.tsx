/**
 * RuleBreakMark — the one mark a stat wears while it is over the cap its rule
 * sets (hard rule R71): the words "Rule breaking", never colour alone. Every
 * sheet's over-cap figure draws it through `StripFigure`'s `over`; nothing
 * else spells its own.
 */

import { componentsCopy } from '../../messages/components'
import { Stat } from './Stat'

export function RuleBreakMark() {
  return (
    // `data-rule-break` finds the mark on a rendered sheet (the R71 gate reads it).
    <span data-rule-break="">
      <Stat size="mini" label={componentsCopy('ruleBreaking')} state="critical" />
    </span>
  )
}
