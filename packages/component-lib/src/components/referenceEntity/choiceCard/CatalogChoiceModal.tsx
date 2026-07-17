import { useMemo } from 'react'
import type { EntitySchemaName, SURefObjectChoice } from 'salvageunion-reference'
import { resolveCatalogChoiceEntities } from 'salvageunion-reference/rules'
import { EntitySearcher } from '../../shared/EntitySearcher'
import { ModalShell } from '../../shared/ModalShell'

type CatalogChoiceModalProps = {
  open: boolean
  onClose: () => void
  /** The schema-only catalog choice being picked (e.g. Armament Bay Weapons System). */
  choice: SURefObjectChoice
  /** Cap the pool to this Tech Level or lower (the crawler's, when known). */
  techLevel?: number
  /** Current selection (option values — entity names). */
  selected: string[]
  /** Emit the next selection (single-select: [] to clear, [name] to pick). */
  onSelect: (values: string[]) => void
}

/**
 * CatalogChoiceModal — a single-select entity picker for a schema-only catalog
 * choice, launched from the entity card. It reuses the shared `EntitySearcher`
 * (search + Tech-Level / trait facets + selection rail) in a `ModalShell`,
 * narrowed to exactly the entities the catalog resolves to (`filter`) so the
 * facets/pool match the rule (e.g. "any Weapons System of the crawler's Tech
 * Level"). Selection is single: picking an entity replaces the prior pick,
 * clicking the chosen one clears it.
 */
export function CatalogChoiceModal({
  open,
  onClose,
  choice,
  techLevel,
  selected,
  onSelect,
}: CatalogChoiceModalProps) {
  const schema = choice.source?.kind === 'catalog' ? choice.source.schema?.[0] : choice.schema?.[0]
  // Resolve the eligible pool once (ids), then narrow the searcher to it — the
  // searcher then derives its own facets from that exact pool.
  const eligibleIds = useMemo(() => {
    const list = resolveCatalogChoiceEntities(
      choice,
      typeof techLevel === 'number' ? { techLevel } : undefined
    )
    return new Set(list.map((e) => ('id' in e && typeof e.id === 'string' ? e.id : '')))
  }, [choice, techLevel])

  if (!schema) return null

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={choice.name}
      maxWidth="max-w-5xl"
    >
      <EntitySearcher
        schema={schema as EntitySchemaName}
        selected={selected}
        onToggle={(ref) => onSelect(selected.includes(ref) ? [] : [ref])}
        filter={(item) => eligibleIds.has(item.id)}
        chosenLabel="Chosen"
        emptyMessage="No matching entities."
        resultsFloating
      />
    </ModalShell>
  )
}
