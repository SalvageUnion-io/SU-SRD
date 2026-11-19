/**
 * StarterSetRoster — Leyline Press's pre-generated crew on its own page: the
 * one Ledger every surface lists it with (`StarterCrewLedger`).
 *
 * It is a pseudo-Game rather than a Game. Nobody is a member, nothing in it can
 * change, and it is the same for everyone — signed out included, because
 * reading it needs no account. Each line opens the build's read-only sheet
 * (`/starter/:kind/:id`), and, signed in, offers "Copy to…" Shelves or one of
 * the player's Games. The copy is theirs; the template is untouched
 * (`lib/starterSet/copyStarter.ts`).
 *
 * The band's control copies the whole crew at once (`CopyCrew`), and
 * `?copy=crew` offers that copy on arrival: the SRD's Starter Set landing
 * links here with it.
 *
 * On its own page the Quickstart's crew follows, laid out the same way under
 * its own Slab, whose control copies that crew (`?copy=quickstart`).
 *
 * Rendered on its own page (`/starter`) and under the sign-in panel on a
 * signed-out Roster.
 */

import type { CSSProperties } from 'react'
import {
  ChapterBand,
  PageShell,
  Slab,
  SlabLookProvider,
  Text,
  tokens,
} from '../../components/index'
import { useConfirm } from '../../components/shared/useConfirm'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import {
  QUICKSTART_BOOK,
  STARTER_SET_ADVENTURE,
  STARTER_SET_PUBLISHER,
} from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { useSync } from '../../replica/syncContext'
import { CopyCrew } from './CopyCrew'
import { StarterCrewLedger } from './StarterCrewLedger'
import { useCopyCrewOnArrival } from './useCopyCrewOnArrival'

const HEADER = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  marginBottom: tokens.space[12],
} satisfies CSSProperties

// Under the signed-out Roster's sign-in panel the h2 keeps its distance. On its
// own page the band is the page shell's first child, so it bleeds to the
// masthead.
const SUB_HEADER = { ...HEADER, marginTop: tokens.space[32] } satisfies CSSProperties

type StarterSetRosterProps = {
  /** `h1` on its own page; `h2` under the signed-out Roster's sign-in panel. */
  headingLevel?: 'h1' | 'h2'
  /** The page's `?copy=`: `crew` offers the whole crew's copy on arrival. */
  copy?: string
}

export function StarterSetRoster({ headingLevel = 'h2', copy }: StarterSetRosterProps) {
  const { status } = useSync()
  const { confirm, dialog } = useConfirm()
  useCopyCrewOnArrival(copy, confirm)

  const body = (
    // MOCK (density mock, sheet variant): the crew pages read as the sheets
    // do — labels on rules, and the crew as a paired manifest.
    <SlabLookProvider value="rule">
      <section aria-label={buildStarterSetCopy('starterSet2')}>
        <div style={headingLevel === 'h1' ? HEADER : SUB_HEADER}>
          {headingLevel === 'h2' && (
            <Slab as="h2" label={buildStarterSetCopy('starterSet2')} flush />
          )}
          <Text variant="body">
            The pre-generated crew of {STARTER_SET_ADVENTURE}, owned by {STARTER_SET_PUBLISHER}.
            Read-only reference: open any sheet to read it.{' '}
            {status === 'live'
              ? buildStarterSetCopy('copyOneIntoYourTraining')
              : buildStarterSetCopy('signInToCopyOne')}
          </Text>
        </div>
        <StarterCrewLedger confirm={confirm} />
      </section>
      {headingLevel === 'h1' && (
        <section aria-label={buildStarterSetCopy('quickstartCrew')}>
          <div style={SUB_HEADER}>
            <Slab
              as="h2"
              label={buildStarterSetCopy('quickstartCrew')}
              actions={<CopyCrew confirm={confirm} roster="quickstart" />}
              flush
            />
            <Text variant="body">
              {buildStarterSetCopy('quickstartCrewIntro', { book: QUICKSTART_BOOK })}{' '}
              {status === 'live'
                ? buildStarterSetCopy('copyOneIntoYourTraining')
                : buildStarterSetCopy('signInToCopyOne')}
            </Text>
          </div>
          <StarterCrewLedger roster="quickstart" confirm={confirm} />
        </section>
      )}
      {dialog}
    </SlabLookProvider>
  )
  if (headingLevel === 'h2') return body
  // Its own page sits on the page measure (ruleset §1.10), band and body alike.
  return (
    <PageShell
      measure={PAGE_MEASURE}
      band={
        <ChapterBand
          tone="build"
          measure={PAGE_MEASURE}
          aside={<CopyCrew confirm={confirm} />}
          asideAt="controls"
        >
          {buildStarterSetCopy('starterSet2')}
        </ChapterBand>
      }
    >
      {body}
    </PageShell>
  )
}
