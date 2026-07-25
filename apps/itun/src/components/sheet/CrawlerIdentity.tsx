/**
 * CrawlerIdentityPanel — the crawler poster's IDENTITY card body (redesign
 * Phase 2, the crawler sibling of PilotIdentityPanel / MechIdentityPanel).
 * Poster identity band: Name + Type as labeled identity fields, then the
 * crawler type's special ability and the type itself as compact
 * ReferenceEntityCard entity cards (max 2 columns), then the Description
 * panel.
 *
 * FIELD-section archetype (unified edit language), but the section's own
 * Edit/Done button now lives in the parent `SheetSectionCard`'s header (Phase
 * 2 lifts the chead row into the card chrome) — this panel is CONTROLLED via
 * the `editing` prop rather than owning its own toggle state, mirroring
 * `PilotIdentityPanel` / `MechIdentityPanel`. Type is picker-backed — its
 * edit affordance opens the existing CrawlerTypeEditModal (destructive:
 * resets the special NPC, with its own confirm step).
 *
 * The type card keeps its live surface (special-NPC inset, Keepsake/Motto
 * choice persistence) via CrawlerTypeCard in compact mode; the type's special
 * ability action(s) render as their own sibling compact cards, so the type
 * card strips them to avoid double-rendering.
 */

import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefMetaAction } from 'salvageunion-reference'
import { ReferenceEntityCard } from 'component-lib'

import { resolveCrawlerType } from '../../lib/crawlerRefs'
import type { Crawler } from '../../lib/schemas/crawler'
import { cn } from '../../lib/utils'
import type { useEntityStore } from '../../stores/entityStore'
import { CrawlerTypeEditModal } from '../crawler/CrawlerTypeEditModal'
import { CrawlerTypeCard } from './CrawlerSheetItems'
import { Field } from 'component-lib'
import type { SheetPatch, SheetStoreState } from './sheetViewProps'

/** The standalone ability card never re-renders the action's choice UI. */
const HIDE_CHOICES = { choices: true } as const

/**
 * Resolve the crawler type's special-ability action refs (names) to their SRD
 * action entities. Salvage-tolerant like the other crawler ref lookups: a
 * missing catalog resolves to an empty list rather than throwing.
 */
function resolveTypeAbilities(typeRef: string | undefined): SURefMetaAction[] {
  if (!typeRef) return []
  try {
    const refs = resolveCrawlerType(typeRef)?.actions ?? []
    if (refs.length === 0) return []
    const actions = SalvageUnionReference.Actions.all()
    return refs
      .map((ref) => actions.find((a) => a.id === ref || a.name === ref))
      .filter((a) => a !== undefined)
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
  /** Partial merge on this crawler; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
  /**
   * Section-level edit flag, owned by the parent `SheetSectionCard`'s header
   * Edit/Done button (Phase 2: the chead row lives in the card, not here).
   */
  /** CrawlerTypeCard's NPC inset needs an explicit flag — it writes through
   * the store directly (typeNpc), independent of `patch`. */
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
  const [typePickerOpen, setTypePickerOpen] = useState(false)

  const canEdit = patch !== undefined && !readOnly

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
      <div className="flex min-w-0 flex-col gap-3">
        {/* Poster field row: Name (prominent) + Type (picker-backed). */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Name" value={crawler.name} onSave={canEdit ? saveName : undefined} />
          <Field
            label="Type"
            value={type?.name ?? ''}
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
                <ReferenceEntityCard data={ability} size="medium" hide={HIDE_CHOICES} />
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
        <Field
          label="Description"
          value={crawler.description ?? ''}
          multiline
          placeholder={canEdit ? 'Describe your crawler…' : '—'}
          onSave={canEdit ? saveDescription : undefined}
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
