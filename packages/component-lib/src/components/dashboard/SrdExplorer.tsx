/**
 * SrdExplorer — the Dashboard's SRD Explorer focus (D4).
 *
 * Replaces the old hard stub in `DisplayView`'s `srd` branch. Two ways in:
 *
 *  1. A **search box** over the whole SRD, driven by component-lib's shared
 *     `useSearchCombobox` (the same hook behind the global search) — schema hits
 *     open a category list, entity hits drill straight into the card.
 *  2. **8 category tiles** (Chassis / Systems / Modules / Pilot Abilities /
 *     Equipment / NPCs / Crawler Bays / Roll Tables) mapping to the real ORM
 *     accessors; picking one lists that category, and picking a row drills into
 *     the faithful `ReferenceEntityDisplay` in-panel with a back affordance.
 *
 * Preload hazard: accessor `.all()` is only ever called inside a handler after
 * the ORM is ready (`isLoaded` seed + an idempotent `preload('all')` effect) —
 * never at module scope.
 */

import { useEffect, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../referenceEntity/card/referenceEntityDisplayShim'
import { useSearchCombobox } from '../shared/useSearchCombobox'

const HIDE_CHOICES = { choices: true } as const

/** A drillable SRD row — every entity carries an id + name. */
type SrdRow = { id: string; name: string }

type SrdCategory = {
  /** Stable key (matches the ORM `schemaName` so search-schema hits map here). */
  schemaName: string
  /** Tile label. */
  label: string
  /** Source stamp (CHS / SYS / …). */
  stamp: string
  /** Preload-safe accessor — only invoked in a handler, never at module scope. */
  all: () => SURefEntity[]
}

/**
 * The 8 SRD Explorer categories, each mapped to a real `SalvageUnionReference`
 * accessor. `all()` is a thunk so nothing queries the ORM until a tile is
 * actually clicked (post-preload).
 */
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

/** Sort rows by name for a predictable listing. */
function sortRows(entities: SURefEntity[]): SURefEntity[] {
  return [...entities].sort((a, b) => {
    const an = (a as SrdRow).name ?? ''
    const bn = (b as SrdRow).name ?? ''
    return an.localeCompare(bn)
  })
}

/** Home view: search box + the 8 category tiles. */
function SrdHome({
  ready,
  onPickCategory,
  onPickEntity,
}: {
  ready: boolean
  onPickCategory: (schemaName: string) => void
  onPickEntity: (entity: SURefEntity) => void
}) {
  const {
    query,
    results,
    hasSearched,
    selectedIndex,
    handleInput,
    handleKeyDown,
    submit,
    listboxId,
    optionId,
    inputProps,
    announcement,
  } = useSearchCombobox({
    ready,
    onSubmit: (result) => {
      if (result.kind === 'entity') {
        onPickEntity(result.entity)
      } else {
        onPickCategory(result.schemaId)
      }
    },
  })

  const open = results.length > 0

  return (
    <div className="pc-srd-home">
      <div className="pc-srd-search">
        <input
          type="text"
          className="pc-srd-input"
          placeholder="Search the SRD — chassis, systems, abilities, tables…"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          {...inputProps}
          aria-label="Search the SRD"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
        />
        <div className="pc-srd-live" aria-live="polite">
          {announcement}
        </div>
        {open ? (
          <div className="pc-srd-results" id={listboxId} role="listbox">
            {results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                id={optionId(i)}
                role="option"
                aria-selected={i === selectedIndex}
                className="pc-srd-result"
                data-active={i === selectedIndex ? '' : undefined}
                onClick={() => submit(r)}
              >
                <span className="pc-srd-result-title">{r.title}</span>
                <span className="pc-srd-result-group">{r.group}</span>
              </button>
            ))}
          </div>
        ) : hasSearched && query.trim() ? (
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

export function SrdExplorer() {
  // Seed readiness synchronously if the ORM is already loaded (usual dashboard
  // case), else flip to ready when the idempotent preload resolves.
  const [ready, setReady] = useState(() => SalvageUnionReference.isLoaded('chassis'))
  const [view, setView] = useState<SrdView>({ kind: 'home' })

  useEffect(() => {
    if (ready) return
    let active = true
    void SalvageUnionReference.preload('all').then(() => {
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [ready])

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
    if (!category || !ready) {
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
        ready={ready}
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
