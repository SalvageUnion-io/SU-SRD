import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from '../atoms/interaction'
import { SlabSection } from '../containers/SlabSection'
import { INDEX_NAME, INDEX_NAME_CAPS, Lead, paintFor } from '../entity'
import { grainClass } from '../referenceEntity/card/cardGrain'

/**
 * StartHere — the one onboarding both fronts show: the SRD's home and the app's
 * front door. Three steps in the order a new crew walks them, each a catalog
 * tile (`.su-entity-index`): its chapter's tone band
 * with the step's number at its left, as a tree ability's tier numeral,
 * and the title notched into
 * its foot, then one line on what the step is, framed in the band's colour
 * (R51: a step is no entity, so not R38's subtle ink-40). The steps' words are `START_HERE_STEPS`,
 * spelled once here, so the two tools cannot drift into two onboardings again.
 *
 * What each tool adds is a prop: an `href` per step (the SRD opens the book's
 * creation guide; the app's front door its builders).
 *
 * The tiles stack in the SRD's 20rem sidebar and on a phone, and run three
 * across once the block is 48rem wide (The app's front door) — the
 * `.su-start-here__steps` container query.
 */

type StartHereStepKey = SheetKind

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

const STEPS = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

function StepFace({ step, index }: { step: StartHereStep; index: number }) {
  const paint = paintFor(step.tone, { texture: true })
  return (
    <div className="su-entity-index__frame" style={{ borderColor: paint.background }}>
      <div
        className={cn('su-entity-index__band su-start-here__band', grainClass(paint.grain))}
        data-grain={paint.grain}
        style={{ backgroundColor: paint.background, color: paint.color, columnGap: space[6] }}
      >
        <span className="su-start-here__number">
          <span className="su-sr-only">Step </span>
          {index + 1}
        </span>
        <span className="su-entity-index__notch">
          <h3
            className={cn('su-entity-index__name su-start-here__title', INDEX_NAME_CAPS)}
            style={INDEX_NAME}
          >
            {step.title}
          </h3>
        </span>
      </div>
      <div className="su-entity-index__cells">
        <Lead text={step.body} />
      </div>
    </div>
  )
}

export function StartHere({ id, hrefs = {} }: StartHereProps) {
  return (
    <SlabSection title="Start here" id={id} as="h2" className="su-start-here" page>
      <ol className="su-start-here__steps" style={STEPS}>
        {START_HERE_STEPS.map((step, index) => {
          const href = hrefs[step.key]
          return (
            <li key={step.key} className="su-start-here__item">
              {href ? (
                <a
                  href={href}
                  className={cn(
                    'su-entity-index su-entity-index--bare su-start-here__step',
                    FOCUS_RING
                  )}
                >
                  <StepFace step={step} index={index} />
                </a>
              ) : (
                <div className="su-entity-index su-entity-index--bare">
                  <StepFace step={step} index={index} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </SlabSection>
  )
}
