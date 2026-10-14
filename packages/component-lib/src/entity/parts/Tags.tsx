import { FOCUS_RING } from '../../components/atoms/interaction'
import { Stat } from '../../components/atoms/Stat'
import type { SizeRung } from '../../styles/sizing'
import { cn } from '../../utils/cn'
import { useEntitySurface } from '../entitySurfaceContext'
import { useInsidePeek, usePeekAttrs } from '../peekContext'
import type { TagItem } from './tagItems'

/**
 * One TAG (E9, E17): a trait as a chip like every other, the horizontal
 * `Stat` cell with its parameter, `[Burn | 2]`. It behaves as a Mention does:
 * where the tag sits outside a link (`linkable`), it opens its glossary
 * entry — the page where the surface has a route (the SRD), else the Page
 * opener (ITUN) — and it Peeks on hover, focus or long-press wherever it names
 * an entry. Inside a Peek it does neither (E16).
 *
 * The Tag carries only the entry's ref (the model resolved it), so it needs no
 * glossary loaded: the Peek loads the one it shows.
 */
export function Tag({
  tag,
  linkable = false,
  rung = 'full',
}: {
  tag: TagItem
  linkable?: boolean
  /** The chip's rung: `full` in a body, `compact` in a head band. */
  rung?: SizeRung
}) {
  const { hrefFor, openPage } = useEntitySurface()
  const insidePeek = useInsidePeek()
  const peek = usePeekAttrs(tag.ref)
  const ref = !insidePeek && linkable ? tag.ref : undefined
  const href = ref ? hrefFor(ref) : undefined
  const open = ref && !href && openPage ? () => openPage(ref) : undefined
  const cell = (
    <Stat
      orientation="horizontal"
      label={tag.name}
      value={tag.param?.trim() ? tag.param : undefined}
      size={rung}
      state={tag.modified ? 'modified' : 'default'}
    />
  )
  const shared = {
    'data-tag': '',
    ...peek,
    ...(tag.modified ? { 'data-modified': '' } : {}),
  }
  if (href) {
    return (
      <a href={href} className={cn('su-chip-link', FOCUS_RING)} {...shared}>
        {cell}
      </a>
    )
  }
  if (open) {
    return (
      <button
        type="button"
        className={cn('su-chip-link', FOCUS_RING)}
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
  rung,
}: {
  tags: TagItem[]
  linkable?: boolean
  rung?: SizeRung
}) {
  return (
    <>
      {tags.map((tag) => (
        <Tag key={tag.key} tag={tag} linkable={linkable} rung={rung} />
      ))}
    </>
  )
}
