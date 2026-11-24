import { ChevronDown } from 'lucide-react'
import type { PageContentsEntry } from '../components/classContents.model'
import { Button, capsLabel, FOCUS_RING, tokens } from '../components/index'
import { cn } from '../lib/cn'
import { componentsCopy } from '../messages/components'
import { PAGE_CONTENTS_MENU_ID } from '../runtime/pageContentsMenuId'

/**
 * A long Page's "On this page" on a desktop's band, before Share: one button
 * that opens the Page's sections as a menu under it, so they never take a
 * line of the Page. Below `lg` the Page's own line
 * of links stands instead (`ClassContents`), and the button is not drawn.
 *
 * Static markup: the menu is the browser's popover, so it opens, closes on a
 * press outside or Escape, and holds the top layer with no script; a section
 * followed closes it (`islands.client.ts`).
 */
export function PageContentsMenu({ entries }: { entries: readonly PageContentsEntry[] }) {
  if (entries.length < 2) return null
  return (
    <>
      <Button
        variant="default"
        size="compact"
        className="su-page-action su-page-contents-menu__open"
        popoverTarget={PAGE_CONTENTS_MENU_ID}
      >
        {componentsCopy('onThisPage')}
        <ChevronDown aria-hidden="true" size={tokens.iconSize.compact} />
      </Button>
      <nav
        id={PAGE_CONTENTS_MENU_ID}
        popover="auto"
        className="su-page-contents-menu"
        aria-label={componentsCopy('onThisPage')}
      >
        <p className={cn('su-page-contents-menu__title', capsLabel())} aria-hidden="true">
          {componentsCopy('onThisPage')}
        </p>
        <ul className="su-page-contents-menu__list">
          {entries.map((entry) => (
            <li key={entry.href}>
              <a className={cn('su-page-contents-menu__link', FOCUS_RING)} href={`#${entry.href}`}>
                {entry.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
