/**
 * CrawlerIdentityPanel — the crawler hero's IDENTITY block (redesign phase 3,
 * sibling of PilotIdentityPanel / MechIdentityPanel). Poster top region:
 * Name + Type as labeled identity fields, then the crawler type's special
 * ability and the type itself as compact ReferenceEntityDisplay entity cards
 * (max 2 columns), then the Description panel.
 *
 * FIELD-section archetype (unified edit language): the panel owns its OWN
 * Edit button; fields render read-only by default and flip to inline
 * click-to-edit only while this section is editing. Type is picker-backed —
 * its edit affordance opens the existing CrawlerTypeEditModal (destructive:
 * resets the special NPC, with its own confirm step).
 *
 * The type card keeps its live surface (special-NPC inset, Keepsake/Motto
 * choice persistence) via CrawlerTypeCard in compact mode; the type's special
 * ability action(s) render as their own sibling compact cards, so the type
 * card strips them to avoid double-rendering.
 */

import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'

import { resolveCrawlerType } from '../../lib/crawlerRefs'
import type { Crawler } from '../../lib/schemas/crawler'
import { cn } from '../../lib/utils'
import type { useEntityStore } from '../../stores/entityStore'
import { CrawlerTypeEditModal } from '../crawler/CrawlerTypeEditModal'
import { CrawlerTypeCard } from './CrawlerSheetItems'
import { IdentityField } from './IdentityField'
import { SectionChead, SectionEditButton } from './SheetSection'
import type { SheetPatch, SheetStoreState } from './sheetViewProps'

/** The standalone ability card never re-renders the action's choice UI. */
const HIDE_CHOICES = { choices: true } as const

/**
 * Resolve the crawler type's special-ability action refs (names) to their SRD
 * action entities. Salvage-tolerant like the other crawler ref lookups: a
 * missing catalog resolves to an empty list rather than throwing.
 */
function resolveTypeAbilities(typeRef: string | undefined): SURefEntity[] {
  if (!typeRef) return []
  try {
    const refs = resolveCrawlerType(typeRef)?.actions ?? []
    if (refs.length === 0) return []
    const actions = SalvageUnionReference.Actions.all() as ReadonlyArray<{
      id: string
      name: string
    }>
    return refs
      .map((ref) => actions.find((a) => a.id === ref || a.name === ref))
      .filter((a) => a !== undefined) as unknown as SURefEntity[]
  } catch {
    return []
  }
}

type CrawlerIdentityPanelProps = {
  crawler: Crawler
  /** Injectable store hook — CrawlerTypeCard's choice/NPC persistence. */
  store: typeof useEntityStore
  /** Live write surface for the type modal's multi-write. */
  storeState: SheetStoreState
  /** Partial merge on this crawler; omit on read-only sheets (no Edit button). */
  patch?: SheetPatch
  readOnly?: boolean
  className?: string
}

export function CrawlerIdentityPanel({
  crawler,
  store,
  storeState,
  patch,
  readOnly = false,
  className,
}: CrawlerIdentityPanelProps) {
  // Per-section edit flag — flips ONLY this panel's fields to inline-edit.
  const [editing, setEditing] = useState(false)
  const [typePickerOpen, setTypePickerOpen] = useState(false)

  const canEdit = patch !== undefined && !readOnly
  const isEditing = editing && canEdit

  const type = crawler.type ? resolveCrawlerType(crawler.type) : null
  const abilities = resolveTypeAbilities(crawler.type)

  /** Persist the crawler name (required — never write empty). */
  function saveName(next: string) {
    const trimmed = next.trim()
    if (trimmed) patch?.({ name: trimmed })
  }

  /** Persist the freeform description (empty clears the field). */
  function saveDescription(next: string) {
    patch?.({ description: next.trim() || undefined })
  }

  return (
    <section aria-label="Crawler identity" className={cn('min-w-0', className)}>
      {/* Section header (chead) — owns the panel's OWN Edit button (no global
          mode). Phase 2 lifts this row into SheetSectionCard's header. */}
      <SectionChead
        title="Identity"
        actions={
          canEdit ? (
            <SectionEditButton
              section="Identity"
              editing={isEditing}
              onToggle={() => setEditing((v) => !v)}
            />
          ) : undefined
        }
      />

      <div className="flex min-w-0 flex-col gap-3">
        {/* Poster field row: Name (prominent) + Type (picker-backed). */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <IdentityField label="Name" value={crawler.name} editing={isEditing} onSave={saveName} />
          <IdentityField
            label="Type"
            value={type?.name ?? ''}
            editing={isEditing}
            onEditClick={canEdit ? () => setTypePickerOpen(true) : undefined}
          />
        </div>

        {/* The type's special ability + the type itself as compact entity
            cards (max 2 columns; 1 on mobile). The type card keeps the
            special-NPC inset + Keepsake/Motto persistence. */}
        {(abilities.length > 0 || crawler.type) && (
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
            {abilities.map((ability) => (
              <div key={ability.id} className="min-w-0">
                <ReferenceEntityDisplay data={ability} compact hide={HIDE_CHOICES} />
              </div>
            ))}
            {crawler.type && (
              <div className="min-w-0">
                <CrawlerTypeCard
                  crawlerId={crawler.id}
                  typeRef={crawler.type}
                  typeNpc={crawler.typeNpc}
                  seedSelections={crawler.bayChoices?.[crawler.type]}
                  store={store}
                  readOnly={readOnly}
                  compact
                />
              </div>
            )}
          </div>
        )}

        {/* Description panel — same FIELD section (edits with Identity). */}
        <IdentityField
          label="Description"
          value={crawler.description ?? ''}
          editing={isEditing}
          multiline
          placeholder={canEdit ? 'Describe your crawler…' : '—'}
          onSave={saveDescription}
        />
      </div>

      {/* Type swap — the existing confirmed destructive picker flow. Mounted
          lazily so its reference preload only runs once the picker opens. */}
      {canEdit && typePickerOpen && (
        <CrawlerTypeEditModal
          open
          onClose={() => setTypePickerOpen(false)}
          crawler={crawler}
          storeState={storeState}
        />
      )}
    </section>
  )
}
