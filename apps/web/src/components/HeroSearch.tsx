import type { FormEventHandler, ReactNode } from 'react'
import { HERO_SEARCH_PLACEHOLDER } from '../lib/heroSearch'
import { SEARCH_PAGE, SEARCH_PARAM } from '../lib/searchHref'
import { componentsCopy } from '../messages/components'
import { Button, SearchField } from './index'

/**
 * The 404's search: a wide field and a Search button on its band. The home
 * page searches from the Union bar, as every other page does.
 *
 * Two renderings share this shell so the page never shifts when the island
 * mounts: `HeroSearchStatic` is the server markup (a plain GET form to the
 * home page, `/?q=…`, whose search opens on its query once its island
 * mounts), and `SearchIsland`'s `hero` variant renders the same form around
 * its combobox.
 */

type HeroSearchFormProps = {
  /** The field (and, in the island, its listbox). */
  children: ReactNode
  /** The island's submit handler; the static form goes to `/?q=…` itself. */
  onSubmit?: FormEventHandler<HTMLFormElement>
}

export function HeroSearchForm({ children, onSubmit }: HeroSearchFormProps) {
  return (
    <search>
      <form action={SEARCH_PAGE} method="get" className="su-hero-search" onSubmit={onSubmit}>
        {children}
        <Button type="submit" variant="primary" size="full">
          {componentsCopy('search')}
        </Button>
      </form>
    </search>
  )
}

/** The server markup: the same form, no listeners. */
export function HeroSearchStatic() {
  return (
    <HeroSearchForm>
      <div className="su-hero-search__box">
        <SearchField
          type="search"
          name={SEARCH_PARAM}
          placeholder={HERO_SEARCH_PLACEHOLDER}
          aria-label={componentsCopy('searchTheReference')}
          shortcut="⌘K"
          glyph="full"
          containerClassName="su-hero-search__field"
        />
      </div>
    </HeroSearchForm>
  )
}
