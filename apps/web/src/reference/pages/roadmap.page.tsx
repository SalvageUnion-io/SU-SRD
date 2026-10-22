/**
 * `/roadmap` — what is being built now, next and later (ADR-056).
 *
 * Hand-written, and edited in the repository each release: the lanes below are
 * the page, one per area of the site, with Now, Next and Later across each. No dates, and nothing a publisher has not announced: a roadmap is
 * a statement of intent, and the page says so.
 */

import type { CSSProperties } from 'react'
import type { PageModule, PageResult } from '../../../ssg/types'
import { Eyebrow, InlineRef, SlabSection } from '../../components/index'
import { space, weight } from '../../design/tokens'
import { appPath } from '../../lib/appBase'
import { SITE_URL, SRD_CRUMB, WEBSITE } from '../../lib/constants'
import { BOLD, PROSE, PROSE_12 } from '../../lib/docPageStyles'
import { DOC_PAGES } from '../../lib/docPages'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { DocPage } from '../DocPage'
import { DocPanel } from '../DocPanel'

const TITLE = pageTitle(pagesCopy('roadmap'))
const DESCRIPTION = pagesCopy('roadmapDescription')

/** One line of the roadmap: what it is, then a sentence on what it means for a player. */
type Item = { name: string; detail: string }

/**
 * One swimlane: an area of the site in its band's tone, and what is planned
 * for it now, next and later. An empty column is a lane with nothing there yet.
 */
type Lane = {
  title: string
  /** The band's tone token (`--color-<tone>`). */
  tone: string
  now: readonly Item[]
  next: readonly Item[]
  later: readonly Item[]
}

/** The lanes, top to bottom: the reference, the builder, the table, outside it, and you. */
const LANES: readonly Lane[] = [
  {
    title: pagesCopy('roadmapLaneReference'),
    tone: 'tl-3',
    now: [{ name: pagesCopy('roadmapStarterSet'), detail: pagesCopy('roadmapStarterSetDetail') }],
    next: [],
    later: [{ name: pagesCopy('roadmapLanguages'), detail: pagesCopy('roadmapLanguagesDetail') }],
  },
  {
    title: pagesCopy('roadmapLaneCantina'),
    tone: 'pilot',
    now: [
      { name: pagesCopy('roadmapOffline'), detail: pagesCopy('roadmapOfflineDetail') },
      { name: pagesCopy('roadmapHomebrew'), detail: pagesCopy('roadmapHomebrewDetail') },
    ],
    next: [],
    later: [],
  },
  {
    title: pagesCopy('roadmapLanePlay'),
    tone: 'denizen-band',
    now: [
      { name: pagesCopy('roadmapTableMode'), detail: pagesCopy('roadmapTableModeDetail') },
      { name: pagesCopy('roadmapPrepKit'), detail: pagesCopy('roadmapPrepKitDetail') },
      {
        name: pagesCopy('roadmapSharedMachines'),
        detail: pagesCopy('roadmapSharedMachinesDetail'),
      },
    ],
    next: [],
    later: [],
  },
  {
    title: pagesCopy('roadmapLaneBeyond'),
    tone: 'discord',
    now: [{ name: pagesCopy('roadmapDataOut'), detail: pagesCopy('roadmapDataOutDetail') }],
    next: [
      { name: pagesCopy('roadmapAppDirectory'), detail: pagesCopy('roadmapAppDirectoryDetail') },
      { name: pagesCopy('roadmapOwlbear'), detail: pagesCopy('roadmapOwlbearDetail') },
    ],
    later: [],
  },
  {
    title: pagesCopy('roadmapLaneYourSay'),
    tone: 'ink',
    now: [{ name: pagesCopy('roadmapFeedback'), detail: pagesCopy('roadmapFeedbackDetail') }],
    next: [],
    later: [],
  },
]

const LANE_LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
} satisfies CSSProperties

const ITEM_NAME = { display: 'block', fontWeight: weight.bold } satisfies CSSProperties

/** One column of a lane: its label, then its items, or a quiet dash when there are none. */
function Column({ label, items }: { label: string; items: readonly Item[] }) {
  const empty = items.length === 0
  return (
    <div className="su-roadmap__cell" {...(empty ? { 'data-empty': '' } : {})}>
      <Eyebrow tone="muted" as="h3">
        {label}
      </Eyebrow>
      {empty ? (
        <p className="su-roadmap__empty">{pagesCopy('roadmapNothingYet')}</p>
      ) : (
        <ul className="su-roadmap__items">
          {items.map((item) => (
            <li key={item.name}>
              <span style={ITEM_NAME}>{item.name}</span>
              {item.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The swimlanes: one titled lane per area, Now, Next and Later across it (stacked on a phone). */
function Swimlanes() {
  return (
    <ol style={LANE_LIST} aria-label={pagesCopy('roadmapLanes')}>
      {LANES.map((lane) => (
        <li key={lane.title}>
          <DocPanel title={lane.title} tone={lane.tone} titleAs="h2">
            <div className="su-roadmap__lane">
              <Column label={pagesCopy('roadmapNow')} items={lane.now} />
              <Column label={pagesCopy('roadmapNext')} items={lane.next} />
              <Column label={pagesCopy('roadmapLater')} items={lane.later} />
            </div>
          </DocPanel>
        </li>
      ))}
    </ol>
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

        <Swimlanes />

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
