import type { PageRefIndex } from 'component-lib'
import {
  EntityDetailLinkProvider,
  EntityHrefProvider,
  PatternHrefProvider,
  ReferenceEntityCard,
} from 'component-lib'
import type { SURefEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { getClassSelections } from '../lib/classSelections'
import { srdEntityHref } from '../lib/entityHref'
import { srdPatternHref } from '../lib/patternHref'
import { ClassAbilityTree } from './ClassAbilityTree'
import { ReferenceSurface } from './ReferenceSurface'

type EntityCardStaticProps = {
  item: SURefEntity
  pattern?: SURefObjectAnyPattern
  /** The schema keeps an art place: a censor mark when this item has no art. */
  artSlot?: boolean
  /** The pages its text cites (`lib/pageRefIndex.ts`), to link "p. N". */
  pageRefs?: PageRefIndex
}

/**
 * The reference entity card, rendered to HTML at build time, as the body of
 * its own page (`presentation="page"`, boards 07 and 08): the page's
 * `ChapterBand` carries the title and the site `Footer` the citation, so the
 * card lays out the art, the prose, the stat column and what the entity
 * carries.
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
export function EntityCardStatic({
  item,
  pattern,
  artSlot = false,
  pageRefs,
}: EntityCardStaticProps) {
  const classSelections = getClassSelections(item)
  const classEntity = classSelections.selectedClass || classSelections.selectedAdvancedClass

  return (
    <EntityHrefProvider value={srdEntityHref}>
      <EntityDetailLinkProvider value={true}>
        <PatternHrefProvider value={srdPatternHref}>
          <ReferenceSurface pageRefs={pageRefs}>
            <ReferenceEntityCard
              data={item}
              pattern={pattern}
              size="large"
              presentation="page"
              artSlot={artSlot}
              afterExtraContent={
                classEntity ? <ClassAbilityTree classEntity={classEntity} /> : undefined
              }
              asideLead={!!classEntity}
            />
          </ReferenceSurface>
        </PatternHrefProvider>
      </EntityDetailLinkProvider>
    </EntityHrefProvider>
  )
}
