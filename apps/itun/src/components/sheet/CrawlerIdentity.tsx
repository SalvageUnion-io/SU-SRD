/**
 * CrawlerIdentityPanel — the crawler poster's IDENTITY card body (the crawler
 * sibling of PilotIdentityPanel / MechIdentityPanel).
 * Poster identity band: Name + Type as labeled identity fields, then the
 * crawler type's special ability as a Token that Peeks its card, beside the
 * type's own internals, then the Description panel.
 *
 * FIELD-section archetype (unified edit language). The parent
 * `SheetSectionCard`'s header owns the section's Edit/Done button, so this
 * panel is CONTROLLED via the `editing` prop rather than owning its own toggle
 * state, mirroring
 * `PilotIdentityPanel` / `MechIdentityPanel`. Type is picker-backed — its
 * edit affordance opens the existing CrawlerTypeEditModal (destructive:
 * resets the special NPC, with its own confirm step).
 *
 * The type card keeps its live surface (special-NPC inset, Keepsake/Motto
 * choice persistence) via CrawlerTypeCard in compact mode; the type's special
 * ability action(s) render as their own sibling compact cards, so the type
 * card strips them to avoid double-rendering.
 */

import { Entity, Field, Stat, tokens } from 'component-lib'
import type { Crawler } from 'itun-domain/schemas/crawler'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { parseCrawlerTechLevel } from 'salvageunion-reference/rules'
import { resolveCrawlerType, resolveCrawlerTypeAbilities } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import type { useEntityStore } from '../../stores/entityStore'
import { CrawlerTypeEditModal } from '../crawler/CrawlerTypeEditModal'
import { CrawlerTypeCard } from './CrawlerSheetItems'
import type { SheetPatch, SheetStoreState } from './sheetViewProps.model'

const PANEL = { minWidth: 0 } satisfies CSSProperties

const STACK = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

/** Tech Level ∥ Type; the column template is `.su-sheet-crawler-identity-row` (it steps at sm). */
const TYPE_ROW = {
  display: 'grid',
  alignItems: 'end',
  columnGap: tokens.space[16],
  rowGap: tokens.space[12],
} satisfies CSSProperties

const ABILITY = { minWidth: 0 } satisfies CSSProperties

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
   * Edit/Done button (the chead row lives in the card, not here).
   */
  /** CrawlerTypeCard's NPC inset needs an explicit flag — it writes through
   * the store directly (typeNpc), independent of `patch`. */
  readOnly?: boolean
  /** The built NPC filling the type's NPC slot, if any (ADR-044). */
  typeCrew?: CrewAssignment
}

export function CrawlerIdentityPanel({
  crawler,
  store,
  storeState,
  patch,
  readOnly = false,
  typeCrew,
}: CrawlerIdentityPanelProps) {
  const [typePickerOpen, setTypePickerOpen] = useState(false)

  const canEdit = patch !== undefined && !readOnly

  const type = crawler.type ? resolveCrawlerType(crawler.type) : null
  // Derived, never hand-set — the crawler's stored rung, read here beside the
  // type rather than in the economy rail.
  const techLevel = parseCrawlerTechLevel(crawler.techLevel)
  const abilities = resolveCrawlerTypeAbilities(crawler.type)

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
    <section aria-label="Crawler identity" style={PANEL}>
      <div style={STACK}>
        {/* Name leads at full prominence (the crawler's own name, like a
            pilot's callsign). Tech Level sits to the LEFT of the type: it is
            the crawler's rung, read alongside what kind of crawler it is,
            rather than buried in the economy rail. */}
        <Field
          label="Name"
          value={crawler.name}
          onSave={canEdit ? saveName : undefined}
          prominent
        />
        <div className="su-sheet-crawler-identity-row" style={TYPE_ROW}>
          {/* A STAT, not a Field: the tech level is derived from the crawler's
              stored rung and never typed into, so it reads as a number plate
              like the mech's chassis stats — a field box implied an input.
              Split across the plate's two label lines (Tech / Level) rather
              than one wide line, which stretched the plate out of square. */}
          <Stat
            label="Tech"
            bottomLabel="Level"
            value={techLevel ?? '—'}
            size="compact"
            ariaLabel={`Tech Level ${techLevel ?? '—'}`}
          />
          {/* Read names the type as its Token, which opens and Peeks it. */}
          <Field
            label="Type"
            value={type?.name ?? ''}
            readValue={
              !canEdit && type ? (
                <Entity form="token" entity={type} mode={{ kind: 'link' }} />
              ) : undefined
            }
            onEditClick={canEdit ? () => setTypePickerOpen(true) : undefined}
          />
        </div>

        {/* The type's INTERNALS, laid out directly in identity: no card frame
            around them. The ability and the crew sit side by side and fill the
            band. */}
        {crawler.type && (
          <CrawlerTypeCard
            crawlerId={crawler.id}
            typeRef={crawler.type}
            typeNpc={crawler.typeNpc}
            seedSelections={crawler.bayChoices?.[crawler.type]}
            store={store}
            readOnly={readOnly}
            assigned={typeCrew}
            ability={
              abilities.length > 0 && (
                <ul aria-label="Special ability" className="su-entity-token-list" style={ABILITY}>
                  {abilities.map((ability) => (
                    <li key={ability.id}>
                      <Entity form="token" entity={ability} />
                    </li>
                  ))}
                </ul>
              )
            }
          />
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
