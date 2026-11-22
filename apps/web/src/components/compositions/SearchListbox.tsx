import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize, space, weight } from '../../design/tokens'
import { schemaLabel } from '../../lib/schemaLabels'
import { compositionsCopy } from '../../messages/components-compositions'
import { activateOnKey } from '../atoms/interaction'
import { Stat } from '../atoms/Stat'
import { EmptyState } from '../containers/EmptyState'
import { Pending } from '../containers/Pending'
import type { Paint } from '../entity'
import { Entity } from '../entity/Entity'
import type { LedgerColumn } from '../entity/Ledger'
import { Ledger } from '../entity/Ledger'
import type { EntityFormModel } from '../entity/types'
import { NO_RESULTS } from './searchCopy'
import type { SearchComboboxResult } from './useSearchCombobox'

/** Where a result goes: a link to its page, or an act in place (the Mediator's Reference drills in). */
type SearchTarget =
  | { href: (result: SearchComboboxResult) => string }
  | { open: (result: SearchComboboxResult) => void }

type LinkTarget = Extract<SearchTarget, { href: unknown }>

type SearchListboxProps = {
  /** The combobox's `aria-controls`. */
  id: string
  /** Names the list where nothing else does. */
  label?: string
  /** The index is loaded; until then the list pends. */
  ready: boolean
  results: readonly SearchComboboxResult[]
  /** The option the arrow keys highlight (`useSearchCombobox`). */
  selectedIndex: number
  optionId: (index: number) => string
  /** The model an entity result draws; none, and it is drawn as a category line. */
  modelOf: (result: SearchComboboxResult) => EntityFormModel | undefined
  /** The host's placement: a popup under its field, or a scrolling panel. */
  style?: CSSProperties
  /** Under the empty line, the host's next step: a "Did you mean", or the ways on. */
  none?: ReactNode
  /** "Show more" (`kind: 'more'`) pressed: the combobox's `submit`. Always an act, never a link. */
  onMore?: (result: SearchComboboxResult) => void
} & (
  | {
      /** In a dropdown hung under a field (the Union bar's): the entity results are a Ledger, each a link. */
      size: 'mini'
      target: LinkTarget
    }
  | {
      /** Where the results have the room of a panel (the Mediator's Reference): each entity a Compact. */
      size: 'compact'
      target: SearchTarget
    }
)

/** The loading and empty lines' place in the list. */
const STATUS = {
  paddingBlock: space[12],
  paddingInline: space[16],
} satisfies CSSProperties

/** The empty line over the host's next step. */
const STATUS_NEXT = {
  ...STATUS,
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties

/** Compacts one a line, 8px apart. */
const ROWS = { display: 'flex', flexDirection: 'column', gap: space[8] } satisfies CSSProperties

/** A category result; its hover and highlight ground is `.su-search__category`. */
const CATEGORY = {
  display: 'block',
  fontSize: fontSize.body,
  lineHeight: 'calc(1.25 / 0.875)',
  paddingBlock: space[12],
  paddingInline: space[16],
} satisfies CSSProperties

const CATEGORY_ACT = { ...CATEGORY, cursor: 'pointer' } satisfies CSSProperties

const CATEGORY_TITLE = { color: color.ink, fontWeight: weight.medium } satisfies CSSProperties

const CATEGORY_GROUP = {
  color: color.wkMuted, // design-tokens-ignore(muted-note): a category group label
  fontSize: fontSize.chip,
  lineHeight: 'calc(1 / 0.75)',
  marginTop: space[2],
} satisfies CSSProperties

type Indexed = { result: SearchComboboxResult; index: number }

type Run = { entities: Indexed[] }

/** The results in their own order, each unbroken run of entities one group: a Ledger draws a run. */
function runs(
  results: readonly SearchComboboxResult[],
  isEntity: (result: SearchComboboxResult) => boolean
): readonly (Indexed | Run)[] {
  const out: (Indexed | Run)[] = []
  results.forEach((result, index) => {
    const last = out.at(-1)
    if (!isEntity(result)) out.push({ result, index })
    else if (last && 'entities' in last) last.entities.push({ result, index })
    else out.push({ entities: [{ result, index }] })
  })
  return out
}

/**
 * SearchListbox — the one list a search's results hang in, under the Union
 * bar's field and in the Mediator's Reference alike: the entities a Ledger
 * (a line each, its kind, Tech Level and cost in columns) or a Compact each
 * (`size`), each schema hit a category line, all in the search's own order,
 * the option the arrow keys reach marked `aria-selected`; the index pending,
 * then a search that matched nothing saying so in the searcher's words
 * (`searchCopy`, chrome K8). Every result is a link to its page, or, where the
 * host drills in place, an act.
 */
export function SearchListbox({
  id,
  label,
  ready,
  results,
  selectedIndex,
  optionId,
  modelOf,
  style,
  none,
  onMore,
  ...form
}: SearchListboxProps) {
  const { target } = form
  /** What a line does: "Show more" lengthens the list; another follows `target`. */
  const actOf = (result: SearchComboboxResult) =>
    result.kind === 'more'
      ? () => onMore?.(result)
      : 'open' in target
        ? () => target.open(result)
        : undefined
  const option = (index: number) =>
    ({
      id: optionId(index),
      role: 'option',
      'aria-selected': index === selectedIndex,
      // A link stays a link; an act is reached through the combobox alone.
      ...('open' in target ? { tabIndex: -1 } : {}),
    }) as const
  const line = ({ result, index }: Indexed) => {
    const body = (
      <>
        <div style={CATEGORY_TITLE}>{result.title}</div>
        <div style={CATEGORY_GROUP}>{result.group}</div>
      </>
    )
    const act = actOf(result)
    return 'href' in target && !act ? (
      <a
        key={result.id}
        {...option(index)}
        href={target.href(result)}
        className="su-search__category"
        style={CATEGORY}
      >
        {body}
      </a>
    ) : (
      <div
        key={result.id}
        {...option(index)}
        role="option"
        tabIndex={-1}
        className="su-search__category"
        style={CATEGORY_ACT}
        onClick={act}
        onKeyDown={act && activateOnKey(act)}
      >
        {body}
      </div>
    )
  }
  const entity = ({ result, index }: Indexed) => {
    const model = modelOf(result)
    if (!model) return line({ result, index })
    const link =
      'href' in target ? { href: target.href(result) } : { onOpen: () => target.open(result) }
    return (
      <Entity
        key={result.id}
        size="compact"
        model={model}
        mode={{ kind: 'link', ...link, attrs: option(index) }}
        // Two results of one name (Heat, the guide and the keyword) say their kind.
        labels={
          shared.has(result.title) ? (
            <Stat label={model.kind.stamp ?? result.group} size="mini" />
          ) : undefined
        }
      />
    )
  }
  // The names more than one result carries.
  const titles = results.map((result) => result.title)
  const shared = new Set(titles.filter((title, i) => titles.indexOf(title) !== i))
  const isEntity = (result: SearchComboboxResult) =>
    result.kind === 'entity' && modelOf(result) !== undefined
  return (
    <div id={id} role="listbox" aria-label={label} style={style}>
      {!ready ? (
        <div style={STATUS}>
          <Pending searching />
        </div>
      ) : results.length === 0 ? (
        <div style={none ? STATUS_NEXT : STATUS}>
          <EmptyState variant="inline" body={NO_RESULTS} />
          {none}
        </div>
      ) : form.size === 'mini' ? (
        runs(results, isEntity).map((run) =>
          'entities' in run ? (
            <SearchLedger
              key={run.entities[0]?.result.id}
              run={run.entities}
              selectedIndex={selectedIndex}
              optionId={optionId}
              modelOf={modelOf}
              target={form.target}
            />
          ) : (
            line(run)
          )
        )
      ) : (
        <div style={ROWS}>
          {results.map((result, index) =>
            isEntity(result) ? entity({ result, index }) : line({ result, index })
          )}
        </div>
      )}
    </div>
  )
}

const SEARCH_COLUMNS: readonly LedgerColumn[] = [
  { key: 'kind', label: compositionsCopy('kind'), kind: 'text', phone: true },
  {
    key: 'tl',
    label: compositionsCopy('tl'),
    title: compositionsCopy('techLevel'),
    kind: 'figure',
    phone: true,
  },
  { key: 'cost', label: compositionsCopy('cost'), kind: 'text' },
]

/** Chrome's paint: the dropdown mixes kinds, so its band is ink. */
const INK_PAINT: Paint = {
  background: 'var(--color-ink)',
  color: 'var(--color-paper)',
  grain: 'paper',
  ink: true,
}

/** A run of entity results as one Ledger: the highlighted row filled with ink (`.su-search-ledger`). */
function SearchLedger({
  run,
  selectedIndex,
  optionId,
  modelOf,
  target,
}: Pick<SearchListboxProps, 'selectedIndex' | 'optionId' | 'modelOf'> & {
  run: readonly Indexed[]
  target: LinkTarget
}) {
  const rows = run.flatMap(({ result, index }) => {
    const model = modelOf(result)
    if (!model || result.kind !== 'entity') return []
    const kind = result.page ? result.page.kind : schemaLabel(result.schemaId)
    return [
      {
        id: result.id,
        name: model.title,
        entityRef: model.ref,
        href: target.href(result),
        linkAttrs: {
          id: optionId(index),
          role: 'option',
          'aria-selected': index === selectedIndex,
          // The option is the name alone, its kind in the next cell: named
          // with it, so four results called Stefanus are told apart by ear
          // as they are by eye ("Stefanus, Pattern · Magpie").
          'aria-label': `${model.title}, ${kind}`,
        },
        cells: [kind, model.techLevel != null ? String(model.techLevel) : '', model.cost ?? ''],
      },
    ]
  })
  return (
    <div className="su-search-ledger">
      <Ledger
        label={compositionsCopy('results')}
        paint={INK_PAINT}
        nameLabel={compositionsCopy('results')}
        count={rows.length}
        columns={SEARCH_COLUMNS}
        rows={rows}
        presentation
      />
    </div>
  )
}
