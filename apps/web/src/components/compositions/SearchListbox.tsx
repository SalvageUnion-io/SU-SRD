import type { CSSProperties } from 'react'
import { color, fontSize, space, weight } from '../../design/tokens'
import { compositionsCopy } from '../../messages/components-compositions'
import { activateOnKey } from '../atoms/interaction'
import { EmptyState } from '../containers/EmptyState'
import { Pending } from '../containers/Pending'
import { Entity } from '../entity/Entity'
import type { EntityFormModel } from '../entity/types'
import { NO_RESULTS } from './searchCopy'
import type { SearchComboboxResult } from './useSearchCombobox'

/** Where a result goes: a link to its page, or an act in place (the Mediator's Reference drills in). */
type SearchTarget =
  | { href: (result: SearchComboboxResult) => string }
  | { open: (result: SearchComboboxResult) => void }

type SearchListboxProps = {
  /** The combobox's `aria-controls`. */
  id: string
  /** Names the list where nothing else does. */
  label?: string
  /**
   * The entity results' form (EDL "Which form, where"): `mini` in a dropdown
   * hung under a field (the Union bar's), `row` where the results have the
   * room of a panel (the Mediator's Reference).
   */
  size: 'compact' | 'mini'
  /** The index is loaded; until then the list pends. */
  ready: boolean
  results: readonly SearchComboboxResult[]
  /** The option the arrow keys highlight (`useSearchCombobox`). */
  selectedIndex: number
  optionId: (index: number) => string
  /** The model an entity result draws; none, and it is drawn as a category line. */
  modelOf: (result: SearchComboboxResult) => EntityFormModel | undefined
  target: SearchTarget
  /** The host's placement: a popup under its field, or a scrolling panel. */
  style?: CSSProperties
}

/** The loading and empty lines' place in the list. */
const STATUS = {
  paddingBlock: space[12],
  paddingInline: space[16],
} satisfies CSSProperties

/** Minis one a line, full width (`.su-entity-mini-list`), inset in the popup. */
const TOKENS = { padding: space[8] } satisfies CSSProperties

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

/**
 * SearchListbox — the one list a search's results hang in, under the Union
 * bar's field and in the Mediator's Reference alike: each entity a Mini or a
 * Compact in link mode (`size`), each schema hit a category line, the option the
 * arrow keys reach marked `aria-selected`; the index pending, then a search
 * that matched nothing saying so in the searcher's words (`searchCopy`, chrome
 * K8). Every result is a link to its page, or, where the host drills in place,
 * an act.
 */
export function SearchListbox({
  id,
  label,
  size,
  ready,
  results,
  selectedIndex,
  optionId,
  modelOf,
  target,
  style,
}: SearchListboxProps) {
  return (
    <div id={id} role="listbox" aria-label={label} style={style}>
      {!ready ? (
        <div style={STATUS}>
          <Pending label={compositionsCopy('searchIndex')} />
        </div>
      ) : results.length === 0 ? (
        <div style={STATUS}>
          <EmptyState variant="inline" body={NO_RESULTS} />
        </div>
      ) : (
        <div
          className={size === 'mini' ? 'su-entity-mini-list' : undefined}
          style={size === 'mini' ? TOKENS : ROWS}
        >
          {results.map((result, index) => {
            // A link stays a link; an act is reached through the combobox alone.
            const option = {
              id: optionId(index),
              role: 'option',
              'aria-selected': index === selectedIndex,
              ...('open' in target ? { tabIndex: -1 } : {}),
            } as const
            const model = result.kind === 'entity' ? modelOf(result) : undefined
            const link =
              'href' in target
                ? { href: target.href(result) }
                : { onOpen: () => target.open(result) }
            if (model) {
              const mode = { kind: 'link', ...link, attrs: option } as const
              return size === 'mini' ? (
                <Entity key={result.id} size="mini" context="browse" model={model} mode={mode} />
              ) : (
                <Entity key={result.id} size="compact" model={model} mode={mode} />
              )
            }
            const body = (
              <>
                <div style={CATEGORY_TITLE}>{result.title}</div>
                <div style={CATEGORY_GROUP}>{result.group}</div>
              </>
            )
            return 'href' in link ? (
              <a
                key={result.id}
                {...option}
                href={link.href}
                className="su-search__category"
                style={CATEGORY}
              >
                {body}
              </a>
            ) : (
              <div
                key={result.id}
                {...option}
                role="option"
                tabIndex={-1}
                className="su-search__category"
                style={CATEGORY_ACT}
                onClick={link.onOpen}
                onKeyDown={activateOnKey(link.onOpen)}
              >
                {body}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
