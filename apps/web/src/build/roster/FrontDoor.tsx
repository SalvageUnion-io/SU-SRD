/**
 * FrontDoor — Build's home for a visitor who is not signed in.
 *
 * Signed out, the app is read-only (ADR-034 as amended): there is nothing of the
 * visitor's to list, so `/` is the front door instead —
 *
 *  - **Build's name** on its chapter band (`PRODUCT.build`, the Training Bay)
 *    in Build's pilot-orange tone, under `PRODUCT.descriptor`, with the legacy
 *    tagline quoted beside the name (under it on a phone);
 *  - **the pitch** (`FrontPitch`), as the home's and Play's: what Build is,
 *    the page's one rust action (sign in) and one outline beside it;
 *  - **Start here**, the onboarding path (`StartHere`): Create a Pilot →
 *    Create a Mech → Join or make a Crawler, each opening its builder (signed
 *    out, its sign-in prompt). Playing a Game happens from the Crawler, so it
 *    is not a step of its own;
 *  - **the Starter Set** (`StarterSetCrew`): the pre-generated crew as one
 *    Ledger, each line opening its read-only sheet, with one Leyline Press
 *    credit for the section.
 *
 * Style objects and tokens only (ADR-046).
 */

import { PRODUCT } from 'game-domain/product'
import type { CSSProperties } from 'react'
import {
  Button,
  ChapterBand,
  capsLabel,
  FrontPitch,
  StartHere,
  tokens,
} from '../../components/index'
import { Tagline } from '../../components/Tagline'
import { appPath } from '../../lib/appBase'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { rosterCopy } from '../../messages/build-roster'
import { SignInControl } from '../account/SignInControl'
import { StarterSetCrew } from '../starterSet/StarterSetCrew'

/**
 * Each step opens its builder; signed out, the builder's own sign-in prompt
 * (the steps are the front door's actions).
 */
const STEP_HREFS = {
  pilot: appPath('/pilots/new'),
  mech: appPath('/mechs/new'),
  crawler: appPath('/crawlers/new'),
}

/** The page: the band runs full-bleed, so this is not a padded `PageShell`. */
const PAGE = {
  backgroundColor: tokens.color.wkBg,
  minHeight: '100dvh',
} satisfies CSSProperties

// Its side padding and centring are `.su-page-body`'s: the band's row padding.
const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  // Level-1 blocks 24px apart, as the home's.
  gap: tokens.space[24],
  maxWidth: PAGE_MEASURE,
} satisfies CSSProperties

/** The kicker: brand caps, the eyebrow's tracking. */
const KICKER_CAPS = capsLabel({ size: 'caption', tracking: 'eyebrow' })

/** The Starter Set section: the pitch's second action jumps to it. */
const STARTER_ID = 'front-door-starter'

export function FrontDoor() {
  return (
    <main style={PAGE}>
      <ChapterBand
        tone="build"
        measure={PAGE_MEASURE}
        eyebrow={<span className={KICKER_CAPS}>{PRODUCT.descriptor}</span>}
        asideAt="notch"
        aside={<Tagline />}
      >
        {PRODUCT.build}
      </ChapterBand>

      <div className="su-page-body" style={{ ...COLUMN, paddingBlock: tokens.space[20] }}>
        {/* The pitch, as the home's: what Build is, the page's one rust
            action (sign in) and the outline beside it (ruleset §3.13). */}
        <FrontPitch
          value={rosterCopy('pitchValue')}
          actions={
            <>
              <SignInControl size="full" redirectTo="/" />
              <Button href={`#${STARTER_ID}`} variant="default" size="full">
                {rosterCopy('meetTheStarterCrew')}
              </Button>
            </>
          }
          note={rosterCopy('pitchNote')}
        >
          {rosterCopy('pitchLede')}
        </FrontPitch>
        <StartHere id="front-door-start" hrefs={STEP_HREFS} />
        <StarterSetCrew id={STARTER_ID} note={rosterCopy('starterNote')} />
      </div>
    </main>
  )
}
