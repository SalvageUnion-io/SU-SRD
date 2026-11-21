import { Zap } from 'lucide-react'
import { iconSize } from '../../design/tokens'

/** The cost column's mark before its COST stamp (ledger.md L2, K11): what a row's action spends. */
export function CostMark() {
  return <Zap aria-hidden="true" size={iconSize.mini} className="su-ledger__cost-mark" />
}
