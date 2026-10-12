import { SalvageUnionReference } from 'salvageunion-reference'
import { Badge } from '../../components/chrome/Badge'
import { EntityTooltip } from '../../components/referenceEntity/EntityTooltip'
import { useEntitySurface } from '../entitySurfaceContext'
import type { TagItem } from './tagItems'

/**
 * One TAG (E9, E17): a trait as Badge's chip with its parameter cell,
 * `[Burn | 2]`. Where the surface has a page for it and the tag sits outside
 * a link (`linkable`), it links there; it keeps the glossary hovercard until
 * the Peek replaces it (phase 3).
 */
function Tag({ tag, linkable }: { tag: TagItem; linkable: boolean }) {
  const { hrefFor } = useEntitySurface()
  const href = linkable && tag.ref ? hrefFor(tag.ref) : undefined
  const chip = (
    <Badge
      shape="chip"
      surface="outline"
      param={tag.param}
      data-tag=""
      {...(href ? { as: 'a', href } : {})}
      {...(tag.modified ? { 'data-modified': '' } : {})}
      style={tag.modified ? { boxShadow: '0 0 0 1px var(--color-ink)' } : undefined}
    >
      <span>{tag.name}</span>
    </Badge>
  )
  // A surface that never loads the glossary (the SRD's search, over its
  // build-time index) draws the chip alone.
  if (!tag.schemaName || !SalvageUnionReference.isLoaded(tag.schemaName)) return chip
  return (
    <EntityTooltip schemaName={tag.schemaName} entityName={tag.name} openDelay={300}>
      {chip}
    </EntityTooltip>
  )
}

/**
 * TAGS — the traits after the Stats. A Tag inside a link or a toggle cannot be
 * a link of its own (no nested interactive content), so the form says when it
 * may link.
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
