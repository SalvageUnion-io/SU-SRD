import { ListTree, Search } from 'lucide-react'
import { Button, capsLabel } from '../components/index'
import { iconSize } from '../design/tokens'
import { cn } from '../lib/cn'
import { componentsCopy } from '../messages/components'
import {
  PAGE_JUMP_ATTRIBUTE,
  PAGE_JUMP_LIST_ATTRIBUTE,
  PAGE_JUMP_SHEET_ID,
} from '../runtime/pageJump'

/**
 * A page's way back to search and its sections, on a phone: the header
 * scrolls away with the page, so two small buttons float at the screen's lower
 * right: the search glass, which opens search in one press, and beside it the
 * contents, which opens a sheet, "On this page", with the page's sections
 * (a page with none floats the glass alone). The page's foot leaves them
 * room (`pages.css`), so its last lines scroll clear of them.
 *
 * Served hidden, as static HTML. The page's script (`watchPageJump`) shows
 * them once a page has scrolled past its header and lists the sections
 * it finds; the sheet itself is the browser's popover, so it opens, closes on
 * a press outside or Escape, and holds the top layer with no script at all.
 * From `lg` up the sections stand beside the page, so the button is not
 * drawn (`pages.css`); a tablet keeps it (RR6-19).
 */
export function PageJump() {
  return (
    <div className="su-page-jump" {...{ [PAGE_JUMP_ATTRIBUTE]: '' }} hidden>
      {/* The glass, one press from search wherever the page has scrolled to;
          without the script it opens the Reference's Contents, as the
          sheet's own Search does. */}
      <Button
        href="/reference/"
        linkAs="a"
        variant="default"
        size="iconOnly"
        className="su-page-jump__open su-page-jump__glass"
        aria-label={componentsCopy('searchTheReference')}
        data-search-open=""
      >
        <Search aria-hidden="true" size={iconSize.full} />
      </Button>
      <Button
        variant="default"
        size="iconOnly"
        className="su-page-jump__open su-page-jump__contents"
        aria-label={componentsCopy('onThisPage')}
        popoverTarget={PAGE_JUMP_SHEET_ID}
      >
        <ListTree aria-hidden="true" size={iconSize.full} />
      </Button>
      <div
        id={PAGE_JUMP_SHEET_ID}
        popover="auto"
        className="su-page-jump__sheet"
        role="dialog"
        aria-label={componentsCopy('onThisPage')}
      >
        {/* Search first: where the script runs it focuses the bar's field
            (`data-search-open`), else it opens the Reference's Contents. */}
        <Button
          href="/reference/"
          linkAs="a"
          variant="default"
          size="full"
          className="su-page-jump__search"
          data-search-open=""
        >
          <Search aria-hidden="true" size={iconSize.compact} />
          {componentsCopy('searchTheReference')}
        </Button>
        <p className={cn('su-page-jump__title', capsLabel())}>{componentsCopy('onThisPage')}</p>
        <ul className="su-page-jump__list" {...{ [PAGE_JUMP_LIST_ATTRIBUTE]: '' }} />
      </div>
    </div>
  )
}
