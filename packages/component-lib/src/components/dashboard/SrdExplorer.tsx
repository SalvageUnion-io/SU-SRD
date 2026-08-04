/**
 * SrdExplorer — the Dashboard's SRD Explorer focus (D4).
 *
 * Functionally the **srd landing page, minus the site header**: the same
 * category sections and the same `CatalogTile`s, built from the same
 * `buildCatalogSections()` the landing page and top nav use. It used to carry
 * its own hand-listed 8 categories, so a schema added to the SRD catalog
 * silently never appeared here.
 *
 * Two differences from the landing page, both forced by living in a panel:
 *
 *  1. Tiles **drill in place** (`onActivate`) rather than navigating — a link
 *     would take the player off the Dashboard.
 *  2. Search sits above the catalog rather than in the header, driven by
 *     component-lib's shared `useSearchCombobox` (the same hook behind the
 *     global search). It is the header's one function worth keeping in-panel.
 *
 * Preload hazard: the catalog and the schema listings read the ORM, so they are
 * built only once `ready` is true (`isLoaded` seed + an idempotent
 * `preload('all')` effect) — never at module scope.
 */

import { useEffect, useMemo, useState } from 'react'

import { isSchemaName, SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { buildCatalogSections } from '../../catalog/catalogSections'
import { Button } from '../chrome/Button'
import { Input } from '../chrome/Field'
import { SectionHeader } from '../chrome/SectionHeader'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { CatalogTile } from '../shared/CatalogTile'
import { useSearchCombobox } from '../shared/useSearchCombobox'

const HIDE_CHOICES = { choices: true } as const

/** Sort rows by name for a predictable listing. */
function sortRows(entities: SURefEntity[]): SURefEntity[] {
  return [...entities].sort((a, b) => {
    const an = a.name ?? ''
    const bn = b.name ?? ''
    return an.localeCompare(bn)
  })
}

/** Every entity in a schema, empty when the id isn't a real schema name. */
function entitiesIn(schemaName: string): SURefEntity[] {
  if (!isSchemaName(schemaName)) return []
  return sortRows(SalvageUnionReference.findAllIn(schemaName, () => true))
}

/** Home view: the search box + the SRD catalog's category sections. */
function SrdHome({
  ready,
  onPickSchema,
  onPickEntity,
}: {
  ready: boolean
  onPickSchema: (schemaName: string, label: string) => void
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
        onPickSchema(result.schemaId, result.title)
      }
    },
  })

  // Only built once the ORM is ready — `buildCatalogSections` reads it.
  const sections = useMemo(() => (ready ? buildCatalogSections() : []), [ready])

  const open = results.length > 0

  return (
    <div className="pc-srd-home">
      <div className="pc-srd-search">
        <Input
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

      {ready ? (
        <div className="pc-srd-catalog">
          {sections.map((section) => (
            <div key={section.label}>
              <SectionHeader label={section.label} className="mb-2" />
              <div className="pc-srd-catalog-grid">
                {section.schemas.map((card) => (
                  <CatalogTile
                    key={card.id}
                    name={card.label}
                    catalogBg={card.catalogBg}
                    catalogLabel={card.catalogLabel}
                    onActivate={() => {
                      if (card.kind === 'schema') {
                        onPickSchema(card.schemaName, card.label)
                        return
                      }
                      const entity = entitiesIn(card.schemaName).find((e) => e.id === card.id)
                      if (entity) onPickEntity(entity)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="pc-display-note">Loading reference data…</div>
      )}
    </div>
  )
}

/** Category view: a breadcrumb + a listing of that schema's entities. */
function SrdCategoryList({
  schemaName,
  label,
  onBack,
  onPickEntity,
}: {
  schemaName: string
  label: string
  onBack: () => void
  onPickEntity: (entity: SURefEntity) => void
}) {
  const rows = entitiesIn(schemaName)
  return (
    <div className="pc-srd-list">
      <div className="pc-srd-crumb">
        <Button size="mini" onClick={onBack}>
          ◀ Catalog
        </Button>
        <span className="pc-srd-crumb-title">{label}</span>
      </div>
      {rows.length === 0 ? (
        <div className="pc-display-note">No entries.</div>
      ) : (
        <ul className="pc-srd-rows">
          {rows.map((entity) => {
            const row = entity
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
        <Button size="mini" onClick={onBack}>
          ◀ Back
        </Button>
      </div>
      <ReferenceEntityCard data={entity} hide={HIDE_CHOICES} />
    </div>
  )
}

type SrdCategoryRef = { schemaName: string; label: string }

type SrdView =
  | { kind: 'home' }
  | ({ kind: 'category' } & SrdCategoryRef)
  | { kind: 'entity'; entity: SURefEntity; from: 'home' | SrdCategoryRef }

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
    const from = view.from
    return (
      <div className="pc-display-scroll pc-srd">
        <SrdEntity
          entity={view.entity}
          onBack={() => setView(from === 'home' ? { kind: 'home' } : { kind: 'category', ...from })}
        />
      </div>
    )
  }

  if (view.kind === 'category') {
    if (!ready) {
      return (
        <div className="pc-display-scroll pc-srd">
          <div className="pc-display-note">Loading reference data…</div>
        </div>
      )
    }
    const { schemaName, label } = view
    return (
      <div className="pc-display-scroll pc-srd">
        <SrdCategoryList
          schemaName={schemaName}
          label={label}
          onBack={() => setView({ kind: 'home' })}
          onPickEntity={(entity) =>
            setView({ kind: 'entity', entity, from: { schemaName, label } })
          }
        />
      </div>
    )
  }

  return (
    <div className="pc-display-scroll pc-srd">
      <SrdHome
        ready={ready}
        onPickSchema={(schemaName, label) => {
          if (isSchemaName(schemaName)) setView({ kind: 'category', schemaName, label })
        }}
        onPickEntity={(entity) => setView({ kind: 'entity', entity, from: 'home' })}
      />
    </div>
  )
}
