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
 * A long page's way back to search and its sections, on a phone: the header
 * scrolls away with the page, so a small button floats at the screen's lower
 * right and opens a sheet, "On this page", with search at its top and the
 * page's sections under it.
 *
 * Served hidden, as static HTML. The page's script (`watchPageJump`) shows the
 * button once a long page has scrolled past its header and lists the sections
 * it finds; the sheet itself is the browser's popover, so it opens, closes on
 * a press outside or Escape, and holds the top layer with no script at all.
 * At `sm` and up the header's own field is a scroll away and the sections
 * stand beside the page, so the button is not drawn (`shell.css`).
 */
export function PageJump() {
  return (
    <div className="su-page-jump" {...{ [PAGE_JUMP_ATTRIBUTE]: '' }} hidden>
      <Button
        variant="default"
        size="iconOnly"
        className="su-page-jump__open"
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
