import { cn } from '../../../lib/cn'
import type { Size } from '../../../styles/sizing'
import { FOCUS_RING } from '../../atoms/interaction'
import { Stat } from '../../atoms/Stat'
import { useEntitySurface } from '../entitySurfaceContext'
import { useInsidePeek, usePeekAttrs } from '../peekContext'
import type { TagItem } from './tagItems'

/**
 * One TAG (E9, E17): a trait as a chip like every other, the horizontal
 * `Stat` cell with its parameter, `[Burn | 2]`. It behaves as a Mention does:
 * where the tag sits outside a link (`linkable`), it opens its glossary
 * entry — the page where the surface has a route (the SRD), else the Page
 * opener (The Cantina) — and it Peeks on hover, focus or long-press wherever it names
 * an entry. Inside a Peek it does neither (E16).
 *
 * The Tag carries only the entry's ref (the model resolved it), so it needs no
 * glossary loaded: the Peek loads the one it shows.
 */
export function Tag({
  tag,
  linkable = false,
  size = 'full',
}: {
  tag: TagItem
  linkable?: boolean
  /** The chip's size: `full` in a body, `compact` in a head band. */
  size?: Size
}) {
  const { hrefFor, openPage, linkAs } = useEntitySurface()
  const insidePeek = useInsidePeek()
  const peek = usePeekAttrs(tag.ref)
  const opens = !insidePeek && linkable
  const ref = opens ? tag.ref : undefined
  // A relation to a player unit has no entry: its sheet is its own href.
  const href = opens && tag.href ? tag.href : ref ? hrefFor(ref) : undefined
  const open = ref && !href && openPage ? () => openPage(ref) : undefined
  const cell = (
    <Stat
      orientation="horizontal"
      label={tag.name}
      value={tag.param?.trim() ? tag.param : undefined}
      size={size}
      state={tag.modified ? 'modified' : 'default'}
    />
  )
  const shared = {
    'data-tag': '',
    ...peek,
    ...(tag.modified ? { 'data-modified': '' } : {}),
  }
  if (href) {
    // A root-relative path goes through the app's router link, as a link-mode form's does.
    const Anchor = linkAs && href.startsWith('/') ? linkAs : 'a'
    return (
      <Anchor href={href} className={cn('su-chip-link su-hit-area', FOCUS_RING)} {...shared}>
        {cell}
      </Anchor>
    )
  }
  if (open) {
    return (
      <button
        type="button"
        className={cn('su-chip-link su-hit-area', FOCUS_RING)}
        onClick={(event) => {
          // A tag inside a clickable card opens ITS entry, not the card.
          event.stopPropagation()
          open()
        }}
        {...shared}
      >
        {cell}
      </button>
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
