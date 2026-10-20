/**
 * SrdExplorer — the reference, inside Play (the Mediator's ⋯ › Reference).
 *
 * Functionally the **SRD's home page, minus the site header**: the same
 * Contents chapters (`ContentsChapter`), built from the same `buildChapters()`
 * the home page's index uses, so a schema added to the SRD appears here too.
 *
 * Three views, every one of them a shared src/components surface:
 *
 *  1. **Home** — the Contents, with search above it. Search is the UI library's
 *     `useSearchCombobox` (the hook behind the site's
 *     SearchIsland) in the shared `SearchField`; a row **drills in place**
 *     (its `onOpen`) rather than following its link, which would leave Play.
 *  2. **Category** — that schema in `EntitySearcher`: its text search and
 *     tech-level / trait facets, the pool as Tokens. `mode="browse"`:
 *     nothing is being picked, so there is no rail and a Token's click opens it.
 *  3. **Entity** — the faithful `ReferenceEntityCard`, with a way back.
 *
 * ONE HEAD. The explorer draws the dialog's frame itself (it opens in a
 * `bare` ModalShell): REFERENCE on the cut-out and the × on the band. A
 * category is a chip beside the title, whose × goes back to the Contents, and
 * its searcher draws in that frame (`frame`): its search and filters on the
 * band above the title, as an index's sit on its chapter band, and its list
 * under it, never a second titled box inside the first.
 *
 * Preload hazard: the chapters and the schema listings read the ORM, so they
 * are built only once `useGameData()` is `ready` — never at module scope.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import type { RefEntity, RefEnumSchemaName } from 'salvageunion-reference'
import { isSchemaName, SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import {
  Button,
  ChipButton,
  CloseButton,
  ContentsChapter,
  EntitySearcher,
  Pending,
  ReferenceEntityCard,
  SearchField,
  SearchListbox,
  Stack,
  Stat,
  TitledBox,
  tokens,
  useSearchCombobox,
} from '../../components/index'
import { buildChapters } from '../../lib/chapters'
import { useGameData } from '../../lib/useGameData'

const HIDE_CHOICES = { choices: true } as const
const NOTHING_SELECTED: string[] = []

/**
 * The chapters as the home page sets them: columns of at least 15rem, filled
 * down then across. The panel's own width, not the window's, picks how many.
 */
const CHAPTERS = {
  columnGap: tokens.space[24],
  columns: '3 15rem',
} satisfies CSSProperties

/** Multi-column has no row gap, so each chapter carries its own. */
const CHAPTER = {
  breakInside: 'avoid',
  marginBlockEnd: tokens.space[24],
} satisfies CSSProperties

/** The results under the field: a panel of their own, scrolling past its height. */
const LISTBOX = {
  marginTop: tokens.space[8],
  maxHeight: 260,
  overflowY: 'auto',
} satisfies CSSProperties

const BACK_ROW = { marginBottom: tokens.space[8] } satisfies CSSProperties

/**
 * The frame's body: room for the catalog at a fixed height, so moving between
 * the views never resizes the dialog. Each view scrolls inside it.
 */
const FRAME_BODY = {
  display: 'flex',
  flexDirection: 'column',
  height: '70vh',
  minHeight: 0,
} satisfies CSSProperties

/** Home view: the search box + the SRD's Contents chapters. */
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

  // Only built once the ORM is ready — `buildChapters` reads it.
  const chapters = useMemo(() => (ready ? buildChapters() : []), [ready])

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
        <div style={CHAPTERS}>
          {chapters.map((chapter) => (
            <div key={chapter.id} style={CHAPTER}>
              <ContentsChapter
                id={`srd-explorer-${chapter.id}`}
                title={chapter.title}
                tone={chapter.tone}
                total={chapter.total}
                rows={chapter.rows.map((row) => ({
                  ...row,
                  onOpen: () => onPickSchema(row.schemaId, row.label),
                }))}
              />
            </div>
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

/** The dialog's frame around a view: `top` is what the view sets on the band. */
type SrdFrame = (body: ReactNode, top?: ReactNode) => ReactNode

export function SrdExplorer({ onClose }: { onClose?: () => void }) {
  const { ready } = useGameData()
  const [view, setView] = useState<SrdView>({ kind: 'home' })
  const home = () => setView({ kind: 'home' })

  // The open category, on the band beside the title: its × is the way back.
  const chip =
    view.kind === 'category' ? (
      <ChipButton aria-label={`Close ${view.label}`} onClick={home}>
        <Stat label={view.label} value="✕" size="compact" />
      </ChipButton>
    ) : undefined

  const frame: SrdFrame = (body, top) => (
    <TitledBox
      title="Reference"
      tone="pilot"
      className="su-modal-panel"
      body="flush"
      chips={chip}
      controls={onClose && <CloseButton onClick={onClose} />}
      top={top}
    >
      <div style={FRAME_BODY}>{body}</div>
    </TitledBox>
  )

  return <SrdBody ready={ready} view={view} setView={setView} frame={frame} />
}

/** The open view in the dialog's frame. */
function SrdBody({
  ready,
  view,
  setView,
  frame,
}: {
  ready: boolean
  view: SrdView
  setView: (view: SrdView) => void
  frame: SrdFrame
}) {
  if (view.kind === 'entity') {
    const from = view.from
    return frame(
      <div className="su-play-display-scroll">
        <SrdEntity
          entity={view.entity}
          onBack={() => setView(from === 'home' ? { kind: 'home' } : { kind: 'category', ...from })}
        />
      </div>
    )
  }

  if (view.kind === 'category') {
    if (!ready) {
      return frame(
        <div className="su-play-display-scroll">
          <Pending label="reference data" />
        </div>
      )
    }
    const { schemaName, label } = view
    // The searcher's search and filters go on the band, its list under it.
    return (
      <EntitySearcher
        schema={schemaName}
        mode="browse"
        frame={({ toolbar, body }) => frame(body, toolbar)}
        selected={NOTHING_SELECTED}
        title={label}
        emptyMessage="No entries."
        onOpen={(id) => {
          const entity = SalvageUnionReference.findIn(schemaName, (e) => e.id === id)
          if (entity) setView({ kind: 'entity', entity, from: { schemaName, label } })
        }}
        idOf={(item) => item.id}
      />
    )
  }

  return frame(
    <div className="su-play-display-scroll">
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
