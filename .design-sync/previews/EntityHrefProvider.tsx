/*
 * No story file — the href providers are context, so nothing renders them
 * directly.
 *
 * Two drafts of this card tried to show a before/after and both rendered
 * pixel-identical: a badge that becomes an `<a>` keeps exactly the same
 * treatment — no underline, no colour shift. So the card shows the real call
 * site once and states the effect in its caption, rather than implying a visual
 * difference that does not exist. (`PatternHrefProvider` and
 * `EntityDetailLinkProvider` are documented the same way, for the same reason;
 * `EntityExternalLinkProvider` is the one link provider whose effect IS
 * visible, and its card shows a true before/after.)
 *
 * The subject is a PATTERN card: `useEntityHref` is consumed by `LoadoutBadge`,
 * the per-item badge inside a pattern's loadout, which is the only place a
 * provider changes anything. The top-level card name is not a link at any depth.
 */
import { EntityHrefProvider, ReferenceEntityCard } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/** The SRD's route shape. The library stays route-agnostic; the app supplies this. */
const srdHref = (entity: { schemaName?: string; name: string }) =>
  `https://salvageunion.io/schema/${entity.schemaName ?? 'systems'}/item/${entity.name
    .toLowerCase()
    .replace(/\s+/g, '-')}`

/**
 * Provides an app-specific entity href builder to nested entity displays. With
 * one above it, every badge in the SYSTEMS and MODULES loadout below is a real
 * `<a>` — middle-clickable, hover-previewable, crawlable, focusable. Without
 * one they render inert rather than linking nowhere; the treatment is identical
 * either way.
 */
export function LoadoutBadges() {
  const chassis = SalvageUnionReference.Chassis.all().find((c) => (c.patterns ?? []).length > 0)
  const pat = chassis?.patterns?.[0]
  if (!chassis || !pat) return null
  return (
    <div className="flex max-w-xl flex-col gap-4 bg-paper p-4">
      <Caption>
        every SYSTEMS / MODULES badge below is an anchor — visually identical to the inert form
      </Caption>
      <EntityHrefProvider value={srdHref}>
        <ReferenceEntityCard data={chassis} pattern={pat} />
      </EntityHrefProvider>
    </div>
  )
}
