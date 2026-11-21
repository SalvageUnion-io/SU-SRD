import { useEffect, useMemo, useState } from 'react'
import type { EntitySchemaName, RefObjectChoice } from 'salvageunion-reference'
import { resolveCatalogChoiceEntities } from 'salvageunion-reference/rules'
import { referenceEntityCopy } from '../../../messages/components-reference-entity'
import { Button } from '../../atoms/Button'
import { EntitySearcher } from '../../compositions/EntitySearcher'
import { ModalShell } from '../../containers/ModalShell'

type CatalogChoiceModalProps = {
  open: boolean
  onClose: () => void
  /** The schema-only catalog choice being picked (e.g. Armament Bay Weapons System). */
  choice: RefObjectChoice
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
 * Level"). It picks as every single-select picker does (Change Chassis): a
 * row opens its Page, Choose there marks it, replacing the prior pick, and
 * Apply writes it and closes. Enter in the search marks the first match.
 */
export function CatalogChoiceModal({
  open,
  onClose,
  choice,
  techLevel,
  selected,
  onSelect,
}: CatalogChoiceModalProps) {
  const schema = choice.source?.kind === 'catalog' ? choice.source.schema?.[0] : undefined
  // Resolve the eligible pool once (ids), then narrow the searcher to it — the
  // searcher then derives its own facets from that exact pool.
  const eligibleIds = useMemo(() => {
    const list = resolveCatalogChoiceEntities(
      choice,
      typeof techLevel === 'number' ? { techLevel } : undefined
    )
    return new Set(list.map((e) => ('id' in e && typeof e.id === 'string' ? e.id : '')))
  }, [choice, techLevel])

  // The pick being weighed: written on Apply, dropped on Cancel.
  const current = selected[0] ?? ''
  const [picked, setPicked] = useState(current)
  useEffect(() => {
    if (open) setPicked(current)
  }, [open, current])

  if (!schema) return null

  function apply() {
    if (picked !== current) onSelect(picked ? [picked] : [])
    onClose()
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={choice.name}
      width="page"
      bare
    >
      <EntitySearcher
        schema={schema as EntitySchemaName}
        mode="single"
        selected={picked ? [picked] : []}
        // Choosing replaces the prior pick; choosing the picked one clears it.
        onToggle={(ref) => setPicked((prev) => (prev === ref ? '' : ref))}
        // One entity is ever chosen: "Chosen only" filters nothing useful.
        facets={{ status: false }}
        filter={(item) => eligibleIds.has(item.id)}
        chosenLabel={referenceEntityCopy('chosen')}
        emptyMessage={referenceEntityCopy('noMatchingEntities')}
        title={choice.name}
        onClose={onClose}
        railActions={
          <>
            <Button variant="ghost" size="compact" onClick={onClose}>
              {referenceEntityCopy('cancel')}
            </Button>
            <Button size="compact" disabled={picked === current} onClick={apply}>
              {referenceEntityCopy('apply')}
            </Button>
          </>
        }
      />
    </ModalShell>
  )
}
