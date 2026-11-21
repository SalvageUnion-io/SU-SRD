import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import type { Size } from '../../../styles/sizing'
import { ChipButton } from '../../atoms/ChipButton'
import { FOCUS_RING } from '../../atoms/interaction'
import { Stat } from '../../atoms/Stat'
import { useEntitySurface } from '../entitySurfaceContext'
import { termPeekAttrs, useInsidePeek, usePeekAttrs } from '../peekContext'
import type { TagItem } from './tagItems'

/**
 * One TAG (E9, E17): a trait or a relation as a chip like every other, the
 * horizontal `Stat` cell with its parameter, `[Burn | 2]`, `[CLASS | Engineer]`
 * (`relation()`, C11: what a unit is built on, what a pattern is a pattern of).
 * It behaves as a Mention does:
 * where the tag sits outside a link (`linkable`), it opens its glossary
 * entry — the page where the surface has a route (the SRD), else the Page
 * opener (The app) — and it Peeks on hover, focus or long-press wherever it names
 * an entry. Inside a Peek it does neither (E16).
 *
 * The Tag carries only the entry's ref (the model resolved it), so it needs no
 * glossary loaded: the Peek loads the one it shows.
 *
 * Which links are the app's: a ref's page (`hrefFor`) and an `href` (an app
 * route) are the surface's, through its router link (`linkAs`); a `page` is a
 * Reference page, always a plain anchor.
 */
export function Tag({
  tag,
  linkable = false,
  size = 'compact',
  wrap = false,
}: {
  tag: TagItem
  linkable?: boolean
  /** The chip's size: `full` in a body, `compact` in a head band. */
  size?: Size
  /**
   * Alone on its line in a wrapping row, the chip narrows and its value wraps
   * rather than being cut (C5): a relation in a Page's band or a sheet's
   * stamps, whose value is a name of any length.
   */
  wrap?: boolean
}) {
  const cell = (
    <Stat
      label={tag.name}
      value={tag.param?.trim() ? tag.param : undefined}
      size={size}
      state={tag.modified ? 'modified' : 'default'}
      wrap={wrap}
    />
  )
  return (
    <ChipLink tag={tag} linkable={linkable}>
      {cell}
    </ChipLink>
  )
}

/**
 * What makes a chip a Tag: its `cell` (a `Stat`) opened as the entry it
 * names — a link, the Page opener, or a span that only Peeks (`Tag`'s
 * rules). A band's fact chips (`RNG | Close`, `TL | 2`) wear it around their
 * own cell, so they link as a trait does.
 */
export function ChipLink({
  tag,
  linkable,
  children,
}: {
  tag: TagItem
  linkable: boolean
  children: ReactNode
}) {
  const { hrefFor, openPage, linkAs } = useEntitySurface()
  const insidePeek = useInsidePeek()
  // A chip that names a PLACE on its entry's page (`fragment`: an ability's
  // Tree) is a way there, not a term: it opens on the first press, and its
  // entry's Peek, which says nothing of that place, is not drawn (E27).
  const place = Boolean(tag.fragment)
  const peek = usePeekAttrs(place ? undefined : tag.ref)
  const opens = !insidePeek && linkable
  const ref = opens ? tag.ref : undefined
  // A relation to a player unit has no entry: its sheet is its own href.
  const routed = ref ? hrefFor(ref) : undefined
  const href =
    opens && tag.href ? tag.href : routed && tag.fragment ? `${routed}${tag.fragment}` : routed
  const page = opens && !href ? tag.page : undefined
  const open = ref && !href && openPage ? () => openPage(ref) : undefined
  const cell = children
  const param = tag.param?.trim()
  const shared = {
    'data-tag': '',
    ...peek,
    ...(tag.modified ? { 'data-modified': '' } : {}),
  }
  // A link or button is named for both halves: `Class: Engineer`, not "ClassEngineer".
  const named = param ? { 'aria-label': `${tag.name}: ${param}` } : {}
  if (href) {
    // A root-relative path goes through the app's router link, as a link-mode form's does.
    const Anchor = linkAs && href.startsWith('/') ? linkAs : 'a'
    return (
      <Anchor
        href={href}
        className={cn('su-chip-link', FOCUS_RING)}
        {...shared}
        {...termPeekAttrs(peek)}
        {...named}
      >
        {cell}
      </Anchor>
    )
  }
  if (page) {
    return (
      <a
        href={page}
        className={cn('su-chip-link', FOCUS_RING)}
        {...shared}
        {...termPeekAttrs(peek)}
        {...named}
      >
        {cell}
      </a>
    )
  }
  if (open) {
    return (
      <ChipButton
        onClick={(event) => {
          // A tag inside a clickable card opens ITS entry, not the card.
          event.stopPropagation()
          open()
        }}
        {...shared}
        {...named}
      >
        {cell}
      </ChipButton>
    )
  }
  return (
    <span className="su-chip-link" {...shared}>
      {cell}
    </span>
  )
}

/**
 * TAGS — the traits after the Stats. A Tag inside a link or a toggle cannot be
 * a link of its own (no nested interactive content), so the form says when it
 * may link; it still Peeks on hover there.
 */
export function Tags({
  tags,
  linkable = false,
  size,
}: {
  tags: TagItem[]
  linkable?: boolean
  size?: Size
}) {
  return (
    <>
      {tags.map((tag) => (
        <Tag key={tag.key} tag={tag} linkable={linkable} size={size} />
      ))}
    </>
  )
}
