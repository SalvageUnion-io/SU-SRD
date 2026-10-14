import type { CSSProperties } from 'react'
import { space } from '../../design/tokens'
import { Lead } from '../../entity/parts/Lead'
import { paintFor } from '../../entity/parts/paint'
import { TILE_NAME } from '../../entity/parts/tileName'
import { cn } from '../../utils/cn'
import { FOCUS_RING } from '../atoms/interaction'
import { Slab } from '../atoms/Slab'
import { Stat } from '../atoms/Stat'
import { grainClass } from '../referenceEntity/card/cardGrain'

/**
 * StartHere — the one onboarding both fronts show: the SRD's home and ITUN's
 * front door. Three steps in the order a new crew walks them, each a catalog
 * tile (`.su-entity-tile`, owner's call 2026-10-14): its chapter's tone band
 * with the title notched into its foot and a `STEP | n` chip beside it, then
 * one line on what the step is. The steps' words are `START_HERE_STEPS`,
 * spelled once here, so the two tools cannot drift into two onboardings again.
 *
 * What each tool adds is a prop: an `href` per step (the SRD opens the book's
 * creation guide; ITUN, signed out, has nowhere to send them yet).
 *
 * The tiles stack in the SRD's 20rem sidebar and on a phone, and run three
 * across once the block is 48rem wide (ITUN's front door) — the
 * `.su-start-here__steps` container query.
 */

type StartHereStepKey = 'pilot' | 'mech' | 'crawler'

/** Each step wears its chapter's tone: Pilot Bay, Mech Workshop, Union Crawler. */
type StartHereStep = { key: StartHereStepKey; title: string; body: string; tone: string }

/** The three steps, in order. Playing a Game happens from the Crawler, so it is not a step. */
const START_HERE_STEPS: readonly StartHereStep[] = [
  {
    key: 'pilot',
    title: 'Create a Pilot',
    tone: 'pilot',
    body: 'Pick a class and your first ability, then add a keepsake, motto and background.',
  },
  {
    key: 'mech',
    title: 'Create a Mech',
    tone: 'mech',
    body: 'Choose a chassis and pattern, then fill its system and module slots.',
  },
  {
    key: 'crawler',
    title: 'Join or make a Crawler',
    tone: 'crawler',
    body: 'Your crew shares one Union Crawler. Make it, or open the invite link a crewmate sends you to join their Game.',
  },
]

type StartHereProps = {
  /** The heading's id, which names the section. */
  id: string
  /** Where each step opens, by key. A step without one is not a link. */
  hrefs?: Partial<Record<StartHereStepKey, string>>
}

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
} satisfies CSSProperties

const STEPS = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

function StepFace({ step, index }: { step: StartHereStep; index: number }) {
  const paint = paintFor(step.tone, { texture: true })
  return (
    <div className="su-entity-tile__frame">
      <div
        className={cn('su-entity-tile__band', grainClass(paint.grain))}
        data-grain={paint.grain}
        style={{ backgroundColor: paint.background, color: paint.color, columnGap: space[6] }}
      >
        <span className="su-entity-tile__notch">
          <h3 className="su-entity-tile__name su-start-here__title" style={TILE_NAME}>
            {step.title}
          </h3>
        </span>
        <span className="su-entity-tile__chips">
          <Stat orientation="horizontal" label="Step" value={index + 1} size="compact" />
        </span>
      </div>
      <div className="su-entity-tile__cells">
        <Lead text={step.body} />
      </div>
    </div>
  )
}

export function StartHere({ id, hrefs = {} }: StartHereProps) {
  return (
    <section aria-labelledby={id} className="su-start-here" style={SECTION}>
      <Slab label="Start here" id={id} as="h2" variant="solid" style={{ marginBottom: 0 }} />
      <ol className="su-start-here__steps" style={STEPS}>
        {START_HERE_STEPS.map((step, index) => {
          const href = hrefs[step.key]
          return (
            <li key={step.key} className="su-start-here__item">
              {href ? (
                <a
                  href={href}
                  className={cn(
                    'su-entity-tile su-entity-tile--bare su-start-here__step',
                    FOCUS_RING
                  )}
                >
                  <StepFace step={step} index={index} />
                </a>
              ) : (
                <div className="su-entity-tile su-entity-tile--bare">
                  <StepFace step={step} index={index} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
