import type { UnitsStore } from '../../replica/units'
/**
 * CrawlerIdentityPanel — the crawler poster's IDENTITY card body (the crawler
 * sibling of PilotIdentityPanel / MechIdentityPanel).
 * Poster identity band: the Description first (Name and Type before it in
 * Edit; Read leaves the Type to the band's TYPE chip, the Tech Level to its TL
 * chip), then the crawler type's special ability as a library Compact (a Peek
 * of its card; no lead off an SRD index, EDL E11) beside the type's crew NPC.
 *
 * FIELD-section archetype (unified edit language). The parent
 * `SheetHero` panel's action row owns the section's Edit/Done button, so this
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

import type { Crawler } from 'game-domain/schemas/crawler'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Entity, Field, tokens } from '../../components/index'
import { resolveCrawlerType, resolveCrawlerTypeAbilities } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsState } from '../../replica/units'
import { CrawlerTypeEditModal } from '../crawler/CrawlerTypeEditModal'
import { CrawlerTypeCard } from './CrawlerTypeCard'
import { PhotoBeside } from './PhotoBeside'
import type { SheetPatch } from './sheetViewProps.model'

/** Fills the hero's card body, so the type's internals take the height it has. */
const PANEL = {
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  minWidth: 0,
} satisfies CSSProperties

const STACK = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

type CrawlerIdentityPanelProps = {
  crawler: Crawler
  /** Injectable store hook — CrawlerTypeCard's choice/NPC persistence. */
  store: UnitsStore
  /** Live write surface for the type modal's multi-write. */
  storeState: UnitsState
  /** Partial merge on this crawler; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
  /**
   * Section-level edit flag, owned by the parent `SheetHero` panel's action row
   * Edit/Done button (the row lives in the panel, not here).
   */
  /** CrawlerTypeCard's NPC inset needs an explicit flag — it writes through
   * the store directly (typeNpc), independent of `patch`. */
  readOnly?: boolean
  /** The built NPC filling the type's NPC slot, if any (ADR-044). */
  typeCrew?: CrewAssignment
  /** The crawler's picture (`EntityPhoto`), beside its Name and Type; the rest runs under both. */
  photo?: ReactNode
}

export function CrawlerIdentityPanel({
  crawler,
  store,
  storeState,
  patch,
  readOnly = false,
  typeCrew,
  photo,
}: CrawlerIdentityPanelProps) {
  const [typePickerOpen, setTypePickerOpen] = useState(false)

  const canEdit = patch !== undefined && !readOnly

  const type = crawler.type ? resolveCrawlerType(crawler.type) : null
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
    <section aria-label={buildSheetCopy('crawlerIdentity')} style={PANEL}>
      {/* The Description leads, beside the picture, after the Name and Type
          in Edit; the type's internals run the card's full width under both in
          Edit, so no empty column stands under the photo,
          and stay beside the photo in Read. */}
      <PhotoBeside
        photo={photo}
        belowBeside={!canEdit}
        below={
          <>
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
                  abilities.length > 0 &&
                  // Contentful Minis, each its head and then its text, Peeking
                  // the whole ability: every sheet entity a contentful Mini.
                  abilities.map((ability) => (
                    <li key={ability.id}>
                      <Entity
                        size="mini"
                        context="play"
                        entity={ability}
                        mode={{ kind: 'link' }}
                        body={{}}
                      />
                    </li>
                  ))
                }
              />
            )}
          </>
        }
      >
        <div style={STACK}>
          {/* The band already names the crawler, so Read never repeats it;
              Edit keeps the field to rename it, as a pilot's Name. Tech Level
              is not here: it is the band's TL chip, beside the type's. */}
          {canEdit && (
            <Field
              label={buildSheetCopy('name')}
              value={crawler.name}
              onSave={saveName}
              prominent
            />
          )}
          {/* Read leaves the Type out: the band's TYPE chip names it; Edit
              keeps it to change it. */}
          {canEdit && (
            <Field
              label={buildSheetCopy('type')}
              value={type?.name ?? ''}
              onEditClick={() => setTypePickerOpen(true)}
            />
          )}
          {/* The Description leads the hero. */}
          <Field
            label={buildSheetCopy('description')}
            value={crawler.description ?? ''}
            multiline
            placeholder={canEdit ? buildSheetCopy('describeYourCrawler') : '—'}
            onSave={canEdit ? saveDescription : undefined}
          />
        </div>
      </PhotoBeside>

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
