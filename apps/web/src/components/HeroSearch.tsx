import type { FormEventHandler, ReactNode } from 'react'
import { HERO_SEARCH_PLACEHOLDER } from '../lib/heroSearch'
import { RESULTS_PAGE, SEARCH_PAGE, SEARCH_PARAM } from '../lib/searchHref'
import { componentsCopy } from '../messages/components'
import { Button, SearchField } from './index'

/**
 * A page's own search: a wide field and a Search button, on the 404's band
 * and under the home's slideshow (where its key cap reads "/").
 *
 * Two renderings share this shell so the page never shifts when the island
 * mounts: `HeroSearchStatic` is the server markup (a plain GET form to the
 * Reference page, `/reference/?q=…`, whose search opens on its query once its island
 * mounts), and `SearchIsland`'s `hero` variant renders the same form around
 * its combobox.
 */

type HeroSearchFormProps = {
  /** The field (and, in the island, its listbox). */
  children: ReactNode
  /** The island's submit handler; the static form goes to `/reference/?q=…` itself. */
  onSubmit?: FormEventHandler<HTMLFormElement>
  /** Where the form goes: the Reference page's search, or the results page's own (RR6-02). */
  action?: string
}

export function HeroSearchForm({ children, onSubmit, action = SEARCH_PAGE }: HeroSearchFormProps) {
  return (
    <search>
      <form action={action} method="get" className="su-hero-search" onSubmit={onSubmit}>
        {children}
        <Button type="submit" variant="primary" size="full">
          {componentsCopy('search')}
        </Button>
      </form>
    </search>
  )
}

/**
 * The server markup: the same form, no listeners. The results page's (`query`)
 * keeps what was searched for in its field, to refine it (RR6-02).
 */
export function HeroSearchStatic({
  shortcut = '⌘K',
  query,
}: {
  shortcut?: string
  query?: string
} = {}) {
  return (
    <HeroSearchForm {...(query === undefined ? {} : { action: RESULTS_PAGE })}>
      <div className="su-hero-search__box">
        <SearchField
          type="search"
          name={SEARCH_PARAM}
          defaultValue={query}
          placeholder={HERO_SEARCH_PLACEHOLDER}
          aria-label={componentsCopy('searchTheReference')}
          shortcut={shortcut}
          glyph="full"
          containerClassName="su-hero-search__field"
        />
      </div>
    </HeroSearchForm>
  )
}
