import { Button, SearchField } from 'component-lib'
import type { FormEventHandler, ReactNode } from 'react'

/**
 * The home page's search (board 06): "search first, in a blue chapter band".
 * A wide field and a Search button, on the Contents band beside the title.
 *
 * Two renderings share this shell so the page never shifts when the island
 * mounts: `HeroSearchStatic` is the server markup (a plain GET form to
 * `/search/`, which works with no JavaScript at all), and `SearchIsland`'s
 * `hero` variant renders the same form around its combobox.
 */

/** The examples the field suggests: one of each kind of thing the SRD holds. */
export const HERO_SEARCH_PLACEHOLDER = 'Gopher, Hacker, Heat, Bio-Titan…'

type HeroSearchFormProps = {
  /** The field (and, in the island, its listbox). */
  children: ReactNode
  /** The island's submit handler; the static form posts to `/search/` itself. */
  onSubmit?: FormEventHandler<HTMLFormElement>
}

export function HeroSearchForm({ children, onSubmit }: HeroSearchFormProps) {
  return (
    <search>
      <form action="/search/" method="get" className="srd-hero-search" onSubmit={onSubmit}>
        {children}
        <Button type="submit" variant="primary" size="full">
          Search
        </Button>
      </form>
    </search>
  )
}

/** The server markup: the same form, no listeners. */
export function HeroSearchStatic() {
  return (
    <HeroSearchForm>
      <div className="srd-hero-search__box">
        <SearchField
          type="search"
          name="q"
          placeholder={HERO_SEARCH_PLACEHOLDER}
          aria-label="Search the SRD"
          shortcut="⌘K"
          glyphSize={18}
          containerClassName="srd-hero-search__field"
        />
      </div>
    </HeroSearchForm>
  )
}
