/**
 * `/roadmap` — what is being built now, next and later (ADR-056).
 *
 * Hand-written, and edited in the repository each release: the board below is
 * the page, Soon, Next and Later across one lane, each item tagged with its area. No dates, and nothing a publisher has not announced: a roadmap is
 * a statement of intent, and the page says so.
 */

import type { CSSProperties } from 'react'
import type { PageModule, PageResult } from '../../../ssg/types'
import { capsLabel } from '../../components/atoms/capsLabel'
import { Eyebrow, InlineRef, SlabSection } from '../../components/index'
import { space, weight } from '../../design/tokens'
import { appPath } from '../../lib/appBase'
import { cn } from '../../lib/cn'
import { SITE_URL, SRD_CRUMB, WEBSITE } from '../../lib/constants'
import { BOLD, PROSE, PROSE_12 } from '../../lib/docPageStyles'
import { DOC_PAGES } from '../../lib/docPages'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { DocPage } from '../DocPage'
import { DocPanel } from '../DocPanel'

const TITLE = pageTitle(pagesCopy('roadmap'))
const DESCRIPTION = pagesCopy('roadmapDescription')

/** The areas an item is tagged with, each in its band's tone (`.su-roadmap__tag[data-area]`). */
type Area = 'reference' | 'cantina' | 'play' | 'beyond' | 'yourSay'

const AREA_LABEL: Record<Area, string> = {
  reference: pagesCopy('roadmapAreaReference'),
  cantina: pagesCopy('roadmapAreaCantina'),
  play: pagesCopy('roadmapAreaPlay'),
  beyond: pagesCopy('roadmapAreaBeyond'),
  yourSay: pagesCopy('roadmapAreaYourSay'),
}

/** One item of the roadmap: its area and its headline, in plain words. */
type Item = { area: Area; name: string }

/** Coming soon: being built for the next release. */
const SOON: readonly Item[] = [
  { area: 'reference', name: pagesCopy('roadmapStarterSet') },
  { area: 'cantina', name: pagesCopy('roadmapOffline') },
  { area: 'cantina', name: pagesCopy('roadmapHomebrew') },
  { area: 'play', name: pagesCopy('roadmapTableMode') },
  { area: 'play', name: pagesCopy('roadmapPrepKit') },
  { area: 'play', name: pagesCopy('roadmapSharedMachines') },
  { area: 'beyond', name: pagesCopy('roadmapDataOut') },
  { area: 'yourSay', name: pagesCopy('roadmapFeedback') },
]

/** Planned once the current work is out. */
const NEXT: readonly Item[] = [
  { area: 'beyond', name: pagesCopy('roadmapAppDirectory') },
  { area: 'beyond', name: pagesCopy('roadmapOwlbear') },
]

/** Further out, and less certain. */
const LATER: readonly Item[] = [{ area: 'reference', name: pagesCopy('roadmapLanguages') }]

const ITEM_NAME = { display: 'block', fontWeight: weight.bold } satisfies CSSProperties

/** One column of the board: its label, then its headlines, each beside its area's tag. */
function Column({ label, items }: { label: string; items: readonly Item[] }) {
  return (
    <div className="su-roadmap__cell">
      <Eyebrow tone="muted" as="h3">
        {label}
      </Eyebrow>
      <ul className="su-roadmap__items">
        {items.map((item) => (
          <li key={item.name}>
            <span className={cn('su-roadmap__tag', TAG)} data-area={item.area}>
              {AREA_LABEL[item.area]}
            </span>
            <span style={ITEM_NAME}>{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const TAG = capsLabel({ size: 'badge' })

/** The board: one lane, Soon, Next and Later across it (stacked on a phone). */
function Board() {
  return (
    <DocPanel title={pagesCopy('roadmapUpAndComing')} titleAs="h2">
      <div className="su-roadmap__lane">
        <Column label={pagesCopy('roadmapSoon')} items={SOON} />
        <Column label={pagesCopy('roadmapNext')} items={NEXT} />
        <Column label={pagesCopy('roadmapLater')} items={LATER} />
      </div>
    </DocPanel>
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
      <DocPage title={pagesCopy('roadmap')} measure="64rem" gap={space[32]}>
        <p style={PROSE}>
          {pagesCopy('roadmapIntro')}{' '}
          <InlineRef href={DOC_PAGES.changelog.href} style={BOLD}>
            {pagesCopy('changelog')}
          </InlineRef>{' '}
          {pagesCopy('roadmapSaysWhatHasShipped')}
        </p>

        <Board />

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
