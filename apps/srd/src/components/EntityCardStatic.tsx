import {
  ClassAbilityTree,
  EntityDetailLinkProvider,
  EntityHrefProvider,
  getClassSelections,
  PatternHrefProvider,
  ReferenceEntityCard,
} from 'component-lib'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { srdEntityHref } from '../lib/entityHref'
import { srdPatternHref } from '../lib/patternHref'

type EntityCardStaticProps = {
  item: SURefEntity
  pattern?: SURefObjectPattern
  titleAs?: 'span' | 'h1'
}

/**
 * The reference entity card, rendered to HTML at build time.
 *
 * This is the same `ReferenceEntityCard` the builder app uses — NOT a
 * simplified stand-in. It carries no `client:*` directive, so Astro renders it
 * to static markup and ships no JS for it, exactly as `SiteHeader` does.
 *
 * That is only possible because the SRD is a Reference surface (ADR-021): it
 * passes no `controls`, and `EntityDetailLinkProvider` puts nested entities in
 * link mode, so every affordance on the card is a navigation rather than client
 * state. The card must therefore never be given a `client:*` directive here —
 * hydrating it would re-introduce the React #418 mismatch that the old
 * island + `GameDataGate` arrangement existed to avoid.
 *
 * Callers must `await SalvageUnionReference.preload(...)` in their Astro
 * frontmatter before rendering this, so the ORM lookups the card makes for
 * nested entities resolve synchronously during the build.
 */
export function EntityCardStatic({ item, pattern, titleAs }: EntityCardStaticProps) {
  const classSelections = getClassSelections(item)
  const classEntity = classSelections.selectedClass || classSelections.selectedAdvancedClass

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <EntityHrefProvider value={srdEntityHref}>
        <EntityDetailLinkProvider value={true}>
          <PatternHrefProvider value={srdPatternHref}>
            <ReferenceEntityCard
              data={item}
              pattern={pattern}
              size="large"
              titleAs={titleAs}
              afterExtraContent={
                classEntity ? <ClassAbilityTree classEntity={classEntity} /> : undefined
              }
              asideLead={!!classEntity}
            />
          </PatternHrefProvider>
        </EntityDetailLinkProvider>
      </EntityHrefProvider>
    </div>
  )
}
