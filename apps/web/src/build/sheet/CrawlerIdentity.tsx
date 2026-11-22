/**
 * CrawlerIdentityFields — the crawler's identity in Edit (the crawler sibling
 * of PilotIdentityPanel and MechIdentityPanel), on the dashboard's masthead
 * under the board: its Name, its Type (picker-backed: the type swap resets its
 * special NPC, with its own confirm step) and its Description.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { CSSProperties } from 'react'
import { lazy, Suspense, useState } from 'react'
import { Field, tokens } from '../../components/index'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsState } from '../../replica/units'
import type { SheetPatch } from './sheetViewProps.model'

/** The Type picker, a chunk of its own: fetched when it first opens. */
const CrawlerTypeEditModal = lazy(() =>
  import('../crawler/CrawlerTypeEditModal').then((m) => ({ default: m.CrawlerTypeEditModal }))
)

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  minWidth: 0,
} satisfies CSSProperties

export function CrawlerIdentityFields({
  crawler,
  storeState,
  patch,
}: {
  crawler: Crawler
  /** Live write surface for the type modal's multi-write. */
  storeState: UnitsState
  /** Partial merge on this crawler. */
  patch: SheetPatch
}) {
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const type = crawler.type ? resolveCrawlerType(crawler.type) : null
  return (
    <section aria-label={buildSheetCopy('crawlerIdentity')} style={STACK}>
      <Field
        label={buildSheetCopy('name')}
        value={crawler.name}
        // Required: never write empty.
        onSave={(next) => {
          const trimmed = next.trim()
          if (trimmed) patch({ name: trimmed })
        }}
        prominent
      />
      <Field
        label={buildSheetCopy('type')}
        value={type?.name ?? ''}
        onEditClick={() => setTypePickerOpen(true)}
      />
      <Field
        label={buildSheetCopy('description')}
        value={crawler.description ?? ''}
        multiline
        placeholder={buildSheetCopy('describeYourCrawler')}
        onSave={(next) => patch({ description: next.trim() || undefined })}
      />
      {/* Mounted lazily so its reference preload only runs once it opens. */}
      {typePickerOpen && (
        <Suspense fallback={null}>
          <CrawlerTypeEditModal
            open
            onClose={() => setTypePickerOpen(false)}
            crawler={crawler}
            storeState={storeState}
          />
        </Suspense>
      )}
    </section>
  )
}
