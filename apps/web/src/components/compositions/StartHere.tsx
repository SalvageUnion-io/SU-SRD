import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { compositionsCopy } from '../../messages/components-compositions'
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
 * its foot, then one line on what the step is. The steps' words are `START_HERE_STEPS`,
 * spelled once here, so the two tools cannot drift into two onboardings again.
 *
 * What each tool adds is a prop: an `href` per step (the SRD opens the book's
 * creation guide; the app's front door its builders). The SRD's Starter Set
 * landing passes its own `steps` and `title` for a box owner's way in.
 *
 * The tiles stack in the SRD's 20rem sidebar and on a phone, and run three
 * across once the block is 48rem wide (The app's front door) — the
 * `.su-start-here__steps` container query.
 */

/** One step: its key (what `hrefs` is keyed by), title, one line, and the tone its band wears. */
export type StartHereStep = {
  key: string
  title: string
  body: string
  tone: string
}

/** The three steps, in order. Playing a Game happens from the Crawler, so it is not a step. */
const START_HERE_STEPS: readonly (StartHereStep & { key: SheetKind })[] = [
  {
    key: 'pilot',
    title: compositionsCopy('createAPilot'),
    tone: 'pilot',
    body: compositionsCopy('pickAClassAndYour'),
  },
  {
    key: 'mech',
    title: compositionsCopy('createAMech'),
    tone: 'mech',
    body: compositionsCopy('chooseAChassisAndPattern'),
  },
  {
    key: 'crawler',
    title: compositionsCopy('joinOrMakeACrawler'),
    tone: 'crawler',
    body: compositionsCopy('yourCrewSharesOneUnion'),
  },
]

type StartHereProps = {
  /** The heading's id, which names the section. */
  id: string
  /** Where each step opens, by key. A step without one is not a link. */
  hrefs?: Partial<Record<string, string>>
  /**
   * Another front door's own steps and heading, in the same tiles: the
   * Starter Set landing's. Every other caller shows the three below.
   */
  steps?: readonly StartHereStep[]
  title?: string
}

const STEPS = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

function StepFace({ step, index }: { step: StartHereStep; index: number }) {
  const paint = paintFor(step.tone, { texture: true })
  return (
    <div className="su-entity-index__frame">
      <div
        className={cn('su-entity-index__band su-start-here__band', grainClass(paint.grain))}
        data-grain={paint.grain}
        style={{ backgroundColor: paint.background, color: paint.color, columnGap: space[6] }}
      >
        <span className="su-start-here__number">
          <span className="su-sr-only">{compositionsCopy('step')} </span>
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

export function StartHere({
  id,
  hrefs = {},
  steps = START_HERE_STEPS,
  title = compositionsCopy('startHere'),
}: StartHereProps) {
  return (
    <SlabSection title={title} id={id} as="h2" className="su-start-here" page>
      <ol className="su-start-here__steps" style={STEPS}>
        {steps.map((step, index) => {
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
