/**
 * `/roadmap` — what is being built now, next and later (ADR-056).
 *
 * Hand-written, and edited in the repository each release: the lists below are
 * the page. No dates, and nothing a publisher has not announced: a roadmap is
 * a statement of intent, and the page says so.
 */

import type { PageModule, PageResult } from '../../../ssg/types'
import { InlineRef, SlabSection } from '../../components/index'
import { space } from '../../design/tokens'
import { appPath } from '../../lib/appBase'
import { SITE_URL, SRD_CRUMB, WEBSITE } from '../../lib/constants'
import { BOLD, bulletList, PROSE, PROSE_12 } from '../../lib/docPageStyles'
import { DOC_PAGES } from '../../lib/docPages'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { DocPage } from '../DocPage'

const TITLE = pageTitle(pagesCopy('roadmap'))
const DESCRIPTION = pagesCopy('roadmapDescription')

const LIST = bulletList(space[8], 'margin')

/** One line of the roadmap: what it is, then a sentence on what it means for a player. */
type Item = { name: string; detail: string }

/** Being built for the next release. */
const NOW: readonly Item[] = [
  { name: pagesCopy('roadmapStarterSet'), detail: pagesCopy('roadmapStarterSetDetail') },
  { name: pagesCopy('roadmapFeedback'), detail: pagesCopy('roadmapFeedbackDetail') },
  { name: pagesCopy('roadmapOffline'), detail: pagesCopy('roadmapOfflineDetail') },
  { name: pagesCopy('roadmapTableMode'), detail: pagesCopy('roadmapTableModeDetail') },
  { name: pagesCopy('roadmapHomebrew'), detail: pagesCopy('roadmapHomebrewDetail') },
  { name: pagesCopy('roadmapPrepKit'), detail: pagesCopy('roadmapPrepKitDetail') },
  { name: pagesCopy('roadmapDataOut'), detail: pagesCopy('roadmapDataOutDetail') },
  { name: pagesCopy('roadmapSharedMachines'), detail: pagesCopy('roadmapSharedMachinesDetail') },
]

/** Planned once the current work is out. */
const NEXT: readonly Item[] = [
  { name: pagesCopy('roadmapAppDirectory'), detail: pagesCopy('roadmapAppDirectoryDetail') },
  { name: pagesCopy('roadmapOwlbear'), detail: pagesCopy('roadmapOwlbearDetail') },
]

/** Further out, and less certain. */
const LATER: readonly Item[] = [
  { name: pagesCopy('roadmapLanguages'), detail: pagesCopy('roadmapLanguagesDetail') },
]

function Items({ items }: { items: readonly Item[] }) {
  return (
    <ul style={LIST}>
      {items.map((item) => (
        <li key={item.name}>
          <strong>{item.name}</strong>: {item.detail}.
        </li>
      ))}
    </ul>
  )
}

function page(): PageResult {
  return {
    meta: {
      title: TITLE,
      description: DESCRIPTION,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: TITLE,
        description: DESCRIPTION,
        url: `${SITE_URL}/roadmap/`,
        isPartOf: WEBSITE,
      },
      breadcrumbs: [SRD_CRUMB, { name: pagesCopy('roadmap'), url: `${SITE_URL}/roadmap/` }],
    },
    children: (
      <DocPage title={pagesCopy('roadmap')} measure="48rem" gap={space[32]}>
        <p style={PROSE}>
          {pagesCopy('roadmapIntro')}{' '}
          <InlineRef href={DOC_PAGES.changelog.href} style={BOLD}>
            {pagesCopy('changelog')}
          </InlineRef>{' '}
          {pagesCopy('roadmapSaysWhatHasShipped')}
        </p>

        <SlabSection as="h2" title={pagesCopy('roadmapNow')} bodyStyle={PROSE_12} page>
          <Items items={NOW} />
        </SlabSection>

        <SlabSection as="h2" title={pagesCopy('roadmapNext')} bodyStyle={PROSE_12} page>
          <Items items={NEXT} />
        </SlabSection>

        <SlabSection as="h2" title={pagesCopy('roadmapLater')} bodyStyle={PROSE_12} page>
          <Items items={LATER} />
        </SlabSection>

        <SlabSection as="h2" title={pagesCopy('roadmapTellUs')} bodyStyle={PROSE_12} page>
          <p>
            {pagesCopy('roadmapSomethingMissing')}{' '}
            <InlineRef href={appPath('/')} style={BOLD}>
              {pagesCopy('roadmapTheApp')}
            </InlineRef>
            {pagesCopy('roadmapChoose')} <strong>{pagesCopy('roadmapFeedback')}</strong>{' '}
            {pagesCopy('roadmapInYourAccountMenu')} <code>{pagesCopy('suFeedback')}</code>{' '}
            {pagesCopy('roadmapWhereThe')}{' '}
            <InlineRef href={DOC_PAGES.discord.href} style={BOLD}>
              {pagesCopy('discordBot')}
            </InlineRef>{' '}
            {pagesCopy('roadmapIsEachNote')}
          </p>
        </SlabSection>
      </DocPage>
    ),
  }
}

export const roadmapPage: PageModule = {
  pattern: '/roadmap',
  page,
}
