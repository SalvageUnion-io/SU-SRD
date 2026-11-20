/** An action's cost on a sheet's row: "2 EP" as the book's pointy box. */

import { ActivationCost } from '../../components/index'

export function Cost({ cost }: { cost: string | undefined }) {
  if (!cost) return null
  const cut = cost.lastIndexOf(' ')
  return cut === -1 ? (
    <ActivationCost cost={cost} currency="" size="mini" />
  ) : (
    <ActivationCost cost={cost.slice(0, cut)} currency={cost.slice(cut + 1)} size="mini" />
  )
}
