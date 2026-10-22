/**
 * `/roadmap` — what is being built now, next and later (ADR-054).
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
import { DocPage } from '../DocPage'

const TITLE = pageTitle('Roadmap')
const DESCRIPTION =
  'What is being built for SalvageUnion.io now, what comes next, and what is further out.'

const LIST = bulletList(space[8], 'margin')

/** One line of the roadmap: what it is, then a sentence on what it means for a player. */
type Item = { name: string; detail: string }

/** Being built for the next release. */
const NOW: readonly Item[] = [
  {
    name: 'A front door for the Starter Set',
    detail: 'one page for new box owners, with the boxed crew ready to copy into The Cantina',
  },
  {
    name: 'Suggest or report',
    detail:
      'send an idea or a problem from the app’s account menu, or with /su feedback in Discord',
  },
  {
    name: 'Sheets at a table with no signal',
    detail:
      'your own sheets and the reference stay readable offline; changes wait until you are back',
  },
  {
    name: 'A phone table mode for Play',
    detail: 'the screen stays awake, with a big roll button and quick HP, AP and Heat',
  },
  {
    name: 'A homebrew library',
    detail: 'browse the patterns, NPCs and crawler bays players choose to share, and copy them',
  },
  {
    name: 'A Mediator prep kit',
    detail: 'build an encounter before the session, then launch it into a Game',
  },
  {
    name: 'Data out',
    detail: 'a versioned, documented dataset API, and Export to Foundry for Pilots and Mechs',
  },
  {
    name: 'Shared Mechs and Crawlers in a Game',
    detail: 'clearer rules for who looks after the crew’s machines',
  },
]

/** Planned once the current work is out. */
const NEXT: readonly Item[] = [
  {
    name: 'The bot in Discord’s App Directory',
    detail: 'add it to your server from Discord itself',
  },
  {
    name: 'An Owlbear Rodeo extension',
    detail: 'your linked sheets beside the map at an online table',
  },
]

/** Further out, and less certain. */
const LATER: readonly Item[] = [
  {
    name: 'The interface in other languages',
    detail: 'the groundwork lands now; languages follow',
  },
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
      breadcrumbs: [SRD_CRUMB, { name: 'Roadmap', url: `${SITE_URL}/roadmap/` }],
    },
    children: (
      <DocPage title="Roadmap" measure="48rem" gap={space[32]}>
        <p style={PROSE}>
          What we are building, and what we would like to build after it. Plans change, so there are
          no dates; this page is updated with each release, and the{' '}
          <InlineRef href={DOC_PAGES.changelog.href} style={BOLD}>
            Changelog
          </InlineRef>{' '}
          says what has shipped.
        </p>

        <SlabSection as="h2" title="Now" bodyStyle={PROSE_12} page>
          <Items items={NOW} />
        </SlabSection>

        <SlabSection as="h2" title="Next" bodyStyle={PROSE_12} page>
          <Items items={NEXT} />
        </SlabSection>

        <SlabSection as="h2" title="Later" bodyStyle={PROSE_12} page>
          <Items items={LATER} />
        </SlabSection>

        <SlabSection as="h2" title="Tell us" bodyStyle={PROSE_12} page>
          <p>
            Something missing, or something broken? Signed in to{' '}
            <InlineRef href={appPath('/')} style={BOLD}>
              the app
            </InlineRef>
            , choose <strong>Suggest or report</strong> in your account menu, or type{' '}
            <code>/su feedback</code> where the{' '}
            <InlineRef href={DOC_PAGES.discord.href} style={BOLD}>
              Discord bot
            </InlineRef>{' '}
            is. Each note becomes a public issue on GitHub, without your name.
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
