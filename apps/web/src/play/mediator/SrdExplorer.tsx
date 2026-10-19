/**
 * SrdExplorer — the reference, inside Play (the Mediator's ⋯ › Reference).
 *
 * Functionally the **srd landing page, minus the site header**: the same
 * category sections and the same `CatalogTile`s, built from the same
 * `buildCatalogSections()` the landing page and top nav use, so a schema added
 * to the SRD catalog appears here too.
 *
 * Three views, every one of them a shared src/components surface:
 *
 *  1. **Home** — the catalog, with search above it. Search is the UI library's
 *     `useSearchCombobox` (the hook behind the site's
 *     SearchIsland) in the shared `SearchField`; tiles **drill in place**
 *     (`onActivate`) rather than navigating, which would leave Play.
 *  2. **Category** — that schema in `EntitySearcher`: its text search and
 *     tech-level / trait facets, the pool as Tokens. `mode="browse"`:
 *     nothing is being picked, so there is no rail and a Token's click opens it.
 *  3. **Entity** — the faithful `ReferenceEntityCard`, with a way back.
 *
 * Preload hazard: the catalog and the schema listings read the ORM, so they are
 * built only once `useGameData()` is `ready` — never at module scope.
 */

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { RefEntity, RefEnumSchemaName } from 'salvageunion-reference'
import { isSchemaName, SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import {
  Button,
  buildCatalogSections,
  CatalogTile,
  EntitySearcher,
  Pending,
  ReferenceEntityCard,
  SearchField,
  SearchListbox,
  Slab,
  Stack,
  tokens,
  useSearchCombobox,
} from '../../components/index'
import { useGameData } from '../../lib/useGameData'

const HIDE_CHOICES = { choices: true } as const
const NOTHING_SELECTED: string[] = []

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

const SECTIONS = { ...STACK, gap: tokens.space[16] } satisfies CSSProperties
const SECTION = { ...STACK, gap: tokens.space[8] } satisfies CSSProperties

/** auto-fill rather than the landing page's viewport breakpoints: those measure
 * the WINDOW, so a narrow display panel on a wide screen would be handed three
 * columns of unreadably small tiles. auto-fill tracks the panel's own width. */
const TILE_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: tokens.space[8],
} satisfies CSSProperties

/** The results under the field: a panel of their own, scrolling past its height. */
const LISTBOX = {
  marginTop: tokens.space[8],
  maxHeight: 260,
  overflowY: 'auto',
} satisfies CSSProperties

const BACK_ROW = { marginBottom: tokens.space[10] } satisfies CSSProperties

/** Home view: the search box + the SRD catalog's category sections. */
function SrdHome({
  ready,
  onPickSchema,
  onPickEntity,
}: {
  ready: boolean
  onPickSchema: (schemaName: string, label: string) => void
  onPickEntity: (entity: RefEntity) => void
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

  // Open once a search has run: its results, or the searcher's empty line.
  const open = hasSearched && query.trim() !== ''

  return (
    <Stack gap={12}>
      <div>
        <SearchField
          type="text"
          name="srd-explorer-search"
          placeholder="Search the Reference — chassis, systems, abilities, tables…"
          autoComplete="off"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          {...inputProps}
          aria-label="Search the Reference"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
        />
        <div className="su-sr-only" aria-live="polite">
          {announcement}
        </div>
        {open && (
          // SEARCH (entity display language §7): every entity result is a Row
          // in link mode, without the lead; a category opens its listing.
          <SearchListbox
            id={listboxId}
            label="Search results"
            form="row"
            ready={ready}
            results={results}
            selectedIndex={selectedIndex}
            optionId={optionId}
            modelOf={(r) => (r.kind === 'entity' ? toEntityModel(r.entity) : undefined)}
            target={{ open: submit }}
            style={LISTBOX}
          />
        )}
      </div>

      {ready ? (
        <div style={SECTIONS}>
          {sections.map((section) => (
            <section key={section.label} style={SECTION}>
              <Slab as="h2" label={section.label} />
              <div style={TILE_GRID}>
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
                      if (!isSchemaName(card.schemaName)) return
                      const entity = SalvageUnionReference.findIn(
                        card.schemaName,
                        (e) => e.id === card.id
                      )
                      if (entity) onPickEntity(entity)
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Pending label="reference data" />
      )}
    </Stack>
  )
}

/** Entity view: the faithful reference card + a back affordance. */
function SrdEntity({ entity, onBack }: { entity: RefEntity; onBack: () => void }) {
  return (
    <div>
      <div style={BACK_ROW}>
        <Button size="mini" onClick={onBack}>
          ◀ Back
        </Button>
      </div>
      <ReferenceEntityCard data={entity} hide={HIDE_CHOICES} />
    </div>
  )
}

type SrdCategoryRef = { schemaName: RefEnumSchemaName; label: string }

type SrdView =
  | { kind: 'home' }
  | ({ kind: 'category' } & SrdCategoryRef)
  | { kind: 'entity'; entity: RefEntity; from: 'home' | SrdCategoryRef }

export function SrdExplorer() {
  const { ready } = useGameData()
  const [view, setView] = useState<SrdView>({ kind: 'home' })

  if (view.kind === 'entity') {
    const from = view.from
    return (
      <div className="su-dash-display-scroll">
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
        <div className="su-dash-display-scroll">
          <Pending label="reference data" />
        </div>
      )
    }
    const { schemaName, label } = view
    return (
      <div className="su-dash-display-scroll">
        <EntitySearcher
          schema={schemaName}
          mode="browse"
          selected={NOTHING_SELECTED}
          title={label}
          emptyMessage="No entries."
          onClose={() => setView({ kind: 'home' })}
          onOpen={(id) => {
            const entity = SalvageUnionReference.findIn(schemaName, (e) => e.id === id)
            if (entity) setView({ kind: 'entity', entity, from: { schemaName, label } })
          }}
          idOf={(item) => item.id}
        />
      </div>
    )
  }

  return (
    <div className="su-dash-display-scroll">
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
