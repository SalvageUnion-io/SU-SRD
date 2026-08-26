/*
 * No story file — context.
 *
 * An earlier draft paired a linked and an unlinked chassis card as a
 * before/after; the two rendered pixel-identical, because a pattern row that
 * becomes an `<a>` keeps exactly the same treatment — no underline, no colour
 * shift. So this card documents the switch in its caption instead of implying a
 * visual difference that does not exist. (`EntityDetailLinkProvider` is
 * documented the same way, for the same reason.)
 */
import { EntityHrefProvider, PatternHrefProvider, ReferenceEntityCard } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '-')

/**
 * Builds the href of a chassis PATTERN's own page.
 *
 * Patterns are nested objects on a chassis, not entities — they have no id and
 * no `schemaName` — so `EntityHrefProvider`'s builder, which only ever sees the
 * chassis, cannot address one. This builder takes both halves of the identity.
 *
 * With it, each row in the PATTERNS section becomes a real anchor:
 * middle-clickable, hover-previewable, crawlable, focusable. The row's
 * appearance is unchanged either way — apps whose patterns have no page (ITUN)
 * simply provide nothing and the rows stay inert rather than navigating
 * somewhere that does not exist.
 */
export function PatternRows() {
  const chassis = SalvageUnionReference.Chassis.all().find((c) => (c.patterns ?? []).length > 1)
  if (!chassis) return null
  const entityHref = (e: { schemaName?: string; name: string }) =>
    `https://salvageunion.io/schema/${e.schemaName ?? 'chassis'}/item/${slug(e.name)}`
  const patternHref = (c: { name: string }, p: { name: string }) =>
    `https://salvageunion.io/schema/chassis/item/${slug(c.name)}/pattern/${slug(p.name)}`
  return (
    <div className="flex max-w-xl flex-col gap-4 bg-paper p-4">
      <Caption>
        every PATTERNS row below is an anchor — the treatment is identical to the inert form
      </Caption>
      <EntityHrefProvider value={entityHref}>
        <PatternHrefProvider value={patternHref}>
          <ReferenceEntityCard data={chassis} />
        </PatternHrefProvider>
      </EntityHrefProvider>
    </div>
  )
}
