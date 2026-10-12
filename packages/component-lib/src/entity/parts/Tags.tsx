import { Badge } from '../../components/atoms/Badge'
import { useEntitySurface } from '../entitySurfaceContext'
import { useInsidePeek, usePeekAttrs } from '../peekContext'
import type { TagItem } from './tagItems'

/**
 * One TAG (E9, E17): a trait as Badge's chip with its parameter cell,
 * `[Burn | 2]`. It behaves as a Mention does: where the tag sits outside a
 * link (`linkable`), it opens its glossary entry — the page where the surface
 * has a route (the SRD), else the Page opener (ITUN) — and it Peeks on hover,
 * focus or long-press wherever it names an entry. Inside a Peek it does
 * neither (E16).
 *
 * The Tag carries only the entry's ref (the model resolved it), so it needs no
 * glossary loaded: the Peek loads the one it shows.
 */
export function Tag({ tag, linkable = false }: { tag: TagItem; linkable?: boolean }) {
  const { hrefFor, openPage } = useEntitySurface()
  const insidePeek = useInsidePeek()
  const peek = usePeekAttrs(tag.ref)
  const ref = !insidePeek && linkable ? tag.ref : undefined
  const href = ref ? hrefFor(ref) : undefined
  const open = ref && !href && openPage ? () => openPage(ref) : undefined
  const as = href
    ? { as: 'a' as const, href }
    : open
      ? {
          as: 'button' as const,
          onClick: (event: { stopPropagation: () => void }) => {
            // A tag inside a clickable card opens ITS entry, not the card.
            event.stopPropagation()
            open()
          },
        }
      : {}
  return (
    <Badge
      shape="chip"
      surface="outline"
      param={tag.param}
      data-tag=""
      {...as}
      {...peek}
      {...(tag.modified ? { 'data-modified': '' } : {})}
      style={tag.modified ? { boxShadow: '0 0 0 1px var(--color-ink)' } : undefined}
    >
      <span>{tag.name}</span>
    </Badge>
  )
}

/**
 * TAGS — the traits after the Stats. A Tag inside a link or a toggle cannot be
 * a link of its own (no nested interactive content), so the form says when it
 * may link; it still Peeks on hover there.
 */
export function Tags({ tags, linkable = false }: { tags: TagItem[]; linkable?: boolean }) {
  return (
    <>
      {tags.map((tag) => (
        <Tag key={tag.key} tag={tag} linkable={linkable} />
      ))}
    </>
  )
}
