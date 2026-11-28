/**
 * A picker row's own parts, beside its Mini: its facts on a wide screen
 * (r4 E6) and its + (r6 E8), which adds it in one press as Enter does, while
 * the name opens it to read.
 */
import { Plus } from 'lucide-react'
import { iconSize } from '../../design/tokens'
import { compositionsCopy } from '../../messages/components-compositions'
import { Button } from '../atoms/Button'
import { Stat } from '../atoms/Stat'
import type { PoolEntity } from './entitySearcherTypes'
import { rowFacts } from './searcherFacts'

/** A wide row's facts beside its Mini (r4 E6): each a `Stat`, in running text. */
export function RowFacts({ entity, wide }: { entity: PoolEntity; wide: boolean }) {
  const facts = rowFacts(entity).filter((each) => wide || each.always)
  if (facts.length === 0) return null
  return (
    <span className="su-searcher__facts">
      {facts.map((each) => (
        <Stat key={each.key} surface="plain" size="mini" label={each.label} value={each.value} />
      ))}
    </span>
  )
}

/** The row's +: adds it now, paying its cost where it can, as Enter does (r6 E8). */
export function RowAdd({
  name,
  onAdd,
  refused,
}: {
  name: string
  onAdd: () => void
  /** Too little to pay it (r8 D4): off, and titled with why. */
  refused?: string | undefined
}) {
  return (
    <Button
      variant="ghost"
      size="iconOnly"
      className="su-searcher__add"
      aria-label={compositionsCopy('addName', { name })}
      title={refused ?? compositionsCopy('addName', { name })}
      disabled={refused !== undefined}
      onClick={onAdd}
    >
      <Plus aria-hidden="true" size={iconSize.compact} />
    </Button>
  )
}
