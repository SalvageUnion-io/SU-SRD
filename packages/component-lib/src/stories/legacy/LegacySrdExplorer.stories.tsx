/**
 * Legacy "before" capture — ITUN Dashboard `SrdExplorer` (the SRD Explorer
 * focus, D4).
 *
 * Reproduces the bespoke `.pc-srd*` shell from
 * apps/in-the-union-now/src/components/dashboard/SrdExplorer.tsx VERBATIM — the
 * search box, the 8 category tiles, the category listing + breadcrumb, and the
 * entity view — styled by the co-located CSS slice (NOT Tailwind). Two things
 * are collapsed for a self-contained capture: (1) the app's `useSearchCombobox`
 * (component-lib's shared hook) is stood in by a trivial local substring filter
 * over the same real accessors, and (2) the ORM-ready gate is unnecessary since
 * the Ladle harness preloads `SalvageUnionReference`. The 8 categories map to
 * the real ORM accessors and the drill-in renders the faithful, canonical
 * `ReferenceEntityDisplay` exactly as the app does. L1 reconciliation: freeze
 * the "before", do not refactor.
 */

import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../../components/referenceEntity/card/referenceEntityDisplayShim'
import { Caption } from '../_harness'
import './LegacySrdExplorer.css'

const HIDE_CHOICES = { choices: true } as const

/** A drillable SRD row — every entity carries an id + name. */
type SrdRow = { id: string; name: string }

type SrdCategory = {
  schemaName: string
  label: string
  stamp: string
  all: () => SURefEntity[]
}

/** The 8 SRD Explorer categories (verbatim), each mapped to a real accessor. */
const SRD_CATEGORIES: readonly SrdCategory[] = [
  {
    schemaName: 'chassis',
    label: 'Chassis',
    stamp: 'CHS',
    all: () => SalvageUnionReference.Chassis.all() as unknown as SURefEntity[],
  },
  {
    schemaName: 'systems',
    label: 'Systems',
    stamp: 'SYS',
    all: () => SalvageUnionReference.Systems.all() as unknown as SURefEntity[],
  },
  {
    schemaName: 'modules',
    label: 'Modules',
    stamp: 'MOD',
    all: () => SalvageUnionReference.Modules.all() as unknown as SURefEntity[],
  },
  {
    schemaName: 'abilities',
    label: 'Pilot Abilities',
    stamp: 'ABL',
    all: () => SalvageUnionReference.Abilities.all() as unknown as SURefEntity[],
  },
  {
    schemaName: 'equipment',
    label: 'Equipment',
    stamp: 'EQP',
    all: () => SalvageUnionReference.Equipment.all() as unknown as SURefEntity[],
  },
  {
    schemaName: 'npcs',
    label: 'NPCs',
    stamp: 'NPC',
    all: () => SalvageUnionReference.NPCs.all() as unknown as SURefEntity[],
  },
  {
    schemaName: 'crawler-bays',
    label: 'Crawler Bays',
    stamp: 'BAY',
    all: () => SalvageUnionReference.CrawlerBays.all() as unknown as SURefEntity[],
  },
  {
    schemaName: 'roll-tables',
    label: 'Roll Tables',
    stamp: 'TBL',
    all: () => SalvageUnionReference.RollTables.all() as unknown as SURefEntity[],
  },
] as const

function sortRows(entities: SURefEntity[]): SURefEntity[] {
  return [...entities].sort((a, b) => {
    const an = (a as SrdRow).name ?? ''
    const bn = (b as SrdRow).name ?? ''
    return an.localeCompare(bn)
  })
}

type SearchHit = { id: string; title: string; group: string; entity: SURefEntity }

/** Home view: search box + the 8 category tiles (verbatim shell). */
function SrdHome({
  onPickCategory,
  onPickEntity,
}: {
  onPickCategory: (schemaName: string) => void
  onPickEntity: (entity: SURefEntity) => void
}) {
  const [query, setQuery] = useState('')

  // Stands in for useSearchCombobox: a substring filter over the same real
  // category accessors (capped), preserving the results-shell shape.
  const trimmed = query.trim().toLowerCase()
  const results: SearchHit[] = trimmed
    ? SRD_CATEGORIES.flatMap((cat) =>
        cat
          .all()
          .filter((e) => ((e as SrdRow).name ?? '').toLowerCase().includes(trimmed))
          .map((entity) => ({
            id: (entity as SrdRow).id,
            title: (entity as SrdRow).name,
            group: cat.label,
            entity,
          }))
      ).slice(0, 12)
    : []
  const open = results.length > 0

  return (
    <div className="pc-srd-home">
      <div className="pc-srd-search">
        <input
          type="text"
          className="pc-srd-input"
          placeholder="Search the SRD — chassis, systems, abilities, tables…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the SRD"
          role="combobox"
          aria-expanded={open}
        />
        {open ? (
          <div className="pc-srd-results" role="listbox">
            {results.map((r) => (
              <button
                key={`${r.group}:${r.id}`}
                type="button"
                role="option"
                aria-selected={false}
                className="pc-srd-result"
                onClick={() => onPickEntity(r.entity)}
              >
                <span className="pc-srd-result-title">{r.title}</span>
                <span className="pc-srd-result-group">{r.group}</span>
              </button>
            ))}
          </div>
        ) : trimmed ? (
          <div className="pc-srd-noresults">No matches.</div>
        ) : null}
      </div>

      <div className="pc-srd-tiles">
        {SRD_CATEGORIES.map((cat) => (
          <button
            key={cat.schemaName}
            type="button"
            className="pc-srd-tile"
            onClick={() => onPickCategory(cat.schemaName)}
          >
            <span className="pc-srd-tile-stamp">{cat.stamp}</span>
            <span className="pc-srd-tile-label">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Category view: a stamped header + a listing of the category's entities. */
function SrdCategoryList({
  category,
  onBack,
  onPickEntity,
}: {
  category: SrdCategory
  onBack: () => void
  onPickEntity: (entity: SURefEntity) => void
}) {
  const rows = sortRows(category.all())
  return (
    <div className="pc-srd-list">
      <div className="pc-srd-crumb">
        <button type="button" className="pc-srd-back" onClick={onBack}>
          ◀ Categories
        </button>
        <span className="pc-srd-crumb-title">
          <span className="pc-srd-tile-stamp">{category.stamp}</span> {category.label}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="pc-display-note">No entries.</div>
      ) : (
        <ul className="pc-srd-rows">
          {rows.map((entity) => {
            const row = entity as SrdRow
            return (
              <li key={row.id}>
                <button type="button" className="pc-srd-row" onClick={() => onPickEntity(entity)}>
                  {row.name ?? row.id}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Entity view: the faithful reference card + a back affordance. */
function SrdEntity({ entity, onBack }: { entity: SURefEntity; onBack: () => void }) {
  return (
    <div className="pc-srd-entity">
      <div className="pc-srd-crumb">
        <button type="button" className="pc-srd-back" onClick={onBack}>
          ◀ Back
        </button>
      </div>
      <ReferenceEntityDisplay data={entity} hide={HIDE_CHOICES} />
    </div>
  )
}

type SrdView =
  | { kind: 'home' }
  | { kind: 'category'; schemaName: string }
  | { kind: 'entity'; entity: SURefEntity; from: 'home' | { schemaName: string } }

function SrdExplorer() {
  const [view, setView] = useState<SrdView>({ kind: 'home' })

  if (view.kind === 'entity') {
    return (
      <div className="pc-display-scroll pc-srd">
        <SrdEntity
          entity={view.entity}
          onBack={() =>
            setView(view.from === 'home' ? { kind: 'home' } : { kind: 'category', ...view.from })
          }
        />
      </div>
    )
  }

  if (view.kind === 'category') {
    const category = SRD_CATEGORIES.find((c) => c.schemaName === view.schemaName)
    if (!category) {
      return (
        <div className="pc-display-scroll pc-srd">
          <div className="pc-display-note">Loading reference data…</div>
        </div>
      )
    }
    const schemaName = category.schemaName
    return (
      <div className="pc-display-scroll pc-srd">
        <SrdCategoryList
          category={category}
          onBack={() => setView({ kind: 'home' })}
          onPickEntity={(entity) => setView({ kind: 'entity', entity, from: { schemaName } })}
        />
      </div>
    )
  }

  return (
    <div className="pc-display-scroll pc-srd">
      <SrdHome
        onPickCategory={(schemaName) => {
          if (SRD_CATEGORIES.some((c) => c.schemaName === schemaName)) {
            setView({ kind: 'category', schemaName })
          }
        }}
        onPickEntity={(entity) => setView({ kind: 'entity', entity, from: 'home' })}
      />
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/PC Srd Explorer' }

export const Default: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <Caption>
      ITUN Dashboard SRD Explorer (SrdExplorer) — bespoke `.pc-srd*` shell: search box, 8 category
      tiles (real ORM accessors), category listing, and drill-in to the canonical
      ReferenceEntityDisplay. Search stands in for useSearchCombobox with a local substring filter.
    </Caption>
    <div
      className="pc-root pc-display-light"
      style={{ height: 560, borderRadius: 5, border: '2.5px solid rgba(40,32,25,0.5)' }}
    >
      <SrdExplorer />
    </div>
  </div>
)
