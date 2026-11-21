/**
 * FrontDoor — an area's home for a visitor who is not signed in: Build's `/`
 * and Play's `/games/` (ruleset §1.8). Signed out, the app is read-only
 * (ADR-034 as amended): there is nothing of the visitor's to list, so the
 * area's home is its front door instead, one tree for both —
 *
 *  - **the area's name** on its chapter band in the area's tone, the legacy
 *    tagline quoted beside it (under it on a phone);
 *  - **the pitch** (`FrontPitch`): what the area is, the page's one rust
 *    action (sign in, back to this area) and one outline beside it, to the
 *    Starter crew;
 *  - **the area's own steps** (`StartHere`, passed in): Build's onboarding
 *    path, Play's "At the table";
 *  - **the Starter Set** (`StarterSetCrew`): the pre-generated crew as one
 *    Ledger, each line opening its read-only sheet.
 *
 * Its words are one set (`rosterCopy`), each area's pitch by its name.
 */

import { PRODUCT } from 'game-domain/product'
import type { ReactNode } from 'react'
import { FrontPitch, PageShell, StartHere } from '../../components/app'
import { Button, ChapterBand } from '../../components/index'
import { Tagline } from '../../components/Tagline'
import { appPath } from '../../lib/appBase'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { rosterCopy } from '../../messages/build-roster'
import { SignInControl } from '../account/SignInControl'
import { StarterSetCrew } from '../starterSet/StarterSetCrew'

/** Each area's front door: its band, its pitch's words, where sign-in returns and the Starter section's id. */
const AREAS = {
  build: {
    name: PRODUCT.build,
    pitch: {
      value: rosterCopy('buildPitchValue'),
      lede: rosterCopy('buildPitchLede'),
      note: rosterCopy('buildPitchNote'),
    },
    signInTo: '/',
    starterId: 'front-door-starter',
    starterNote: rosterCopy('starterNote'),
  },
  play: {
    name: PRODUCT.play,
    pitch: {
      value: rosterCopy('playPitchValue'),
      lede: rosterCopy('playPitchLede'),
      note: rosterCopy('playPitchNote'),
    },
    signInTo: '/games/',
    starterId: 'play-starter',
    starterNote: undefined,
  },
} as const

type FrontDoorProps = {
  /** The area whose front door it is: its band's tone and name, its pitch. */
  area: keyof typeof AREAS
  /** The area's own steps, between the pitch and the Starter crew (a `StartHere`). */
  steps: ReactNode
}

export function FrontDoor({ area, steps }: FrontDoorProps) {
  const door = AREAS[area]
  return (
    <PageShell
      measure={PAGE_MEASURE}
      band={
        <ChapterBand tone={area} measure={PAGE_MEASURE} asideAt="notch" aside={<Tagline />}>
          {door.name}
        </ChapterBand>
      }
    >
      <FrontPitch
        value={door.pitch.value}
        actions={
          <>
            <SignInControl size="full" redirectTo={door.signInTo} />
            <Button href={`#${door.starterId}`} variant="default" size="full">
              {rosterCopy('meetTheStarterCrew')}
            </Button>
          </>
        }
        note={door.pitch.note}
      >
        {door.pitch.lede}
      </FrontPitch>
      {steps}
      <StarterSetCrew id={door.starterId} note={door.starterNote} />
    </PageShell>
  )
}

/**
 * Each of Build's steps opens its builder; signed out, the builder's own
 * sign-in prompt. Playing a Game happens from the Crawler, so it is no step.
 */
const BUILD_STEPS = {
  pilot: appPath('/pilots/new'),
  mech: appPath('/mechs/new'),
  crawler: appPath('/crawlers/new'),
}

/**
 * Build's steps as doors: Create a Pilot, Create a Mech, Join or make a
 * Crawler. Unnumbered, since none needs the one before it. The front door
 * shows them, and so does a Training Bay with nothing in it yet.
 */
export function BuildStartHere({ id }: { id: string }) {
  return <StartHere id={id} hrefs={BUILD_STEPS} numbered={false} />
}

/** Build's front door: its pitch, its steps, the Starter crew. */
export function BuildFrontDoor() {
  return <FrontDoor area="build" steps={<BuildStartHere id="front-door-start" />} />
}
