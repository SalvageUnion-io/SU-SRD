import {
  EntityDetailLinkProvider,
  EntityHrefProvider,
  PatternHrefProvider,
  ReferenceEntityCard,
} from 'component-lib'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { getClassSelections } from '../lib/classSelections'
import { srdEntityHref } from '../lib/entityHref'
import { srdPatternHref } from '../lib/patternHref'
import { ClassAbilityTree } from './ClassAbilityTree'

type EntityCardStaticProps = {
  item: SURefEntity
  pattern?: SURefObjectPattern
  titleAs?: 'span' | 'h1'
}

/**
 * The reference entity card, rendered to HTML at build time.
 *
 * This is the same `ReferenceEntityCard` the builder app uses — NOT a
 * simplified stand-in. It is not an island, so it renders straight into the
 * page's static markup and ships no JS, exactly as `SiteHeader` does.
 *
 * That is only possible because the SRD is a Reference surface (ADR-021): it
 * passes no `controls`, and `EntityDetailLinkProvider` puts nested entities in
 * link mode, so every affordance on the card is a navigation rather than client
 * state. It must therefore never be wrapped in an `<Island>` — that would ship
 * the whole card tree as client JS for no interactive gain.
 *
 * Callers must `await SalvageUnionReference.preload(...)` in their page module
 * before rendering this, so the ORM lookups the card makes for
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
