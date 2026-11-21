import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { compositionsCopy } from '../../messages/components-compositions'
import { Badge } from '../atoms/Badge'
import { FOCUS_RING } from '../atoms/interaction'
import { SlabSection } from '../containers/SlabSection'
import { INDEX_NAME, INDEX_NAME_CAPS, Lead, paintFor } from '../entity'
import { grainClass } from '../referenceEntity/card/cardGrain'
import { tileImageSizes } from './cardImageSizes'

/**
 * StartHere — a front page's row of tiles: the onboarding path Build's front
 * door shows, and the doors the home and Play's front door open on. Each is a
 * catalog tile (`.su-entity-index`): its tone band with the title notched into
 * its foot, then one line on what it is, framed in the band's colour (R38: a
 * step is no entity, so not R38's subtle ink-40). A step wears its number at
 * the band's left, as a tree ability's tier numeral; a door (`numbered` off)
 * wears none, and may carry its art in the tile's art place and one read
 * stamp at the band's right. The onboarding's words are `START_HERE_STEPS`,
 * spelled once here.
 *
 * What each page adds is a prop: an `href` per tile (the app's front door
 * opens its builders), or its own `steps` and `title` (the home's three ways
 * in, Play's "At the table", the Starter Set landing's way in for a box owner).
 *
 * The tiles wrap, each at least 14rem and growing to fill its line, so a last
 * line never ends on an empty track (the fill-grid ruling): one a line in a
 * sidebar and on a phone, three across from a 48rem block.
 */

/** One step: its key (what `hrefs` is keyed by), title, one line, and the tone its band wears. */
export type StartHereStep = {
  key: string
  title: string
  body: string
  tone: string
  /** A door's art (from R2), drawn in the catalog tile's art place over the band. */
  art?: { url: string; srcSet?: string; alt: string }
  /** A door's one read stamp, at the band's right on the name's line (`Free`). */
  stamp?: string
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
  /** Steps are numbered in order; doors (the home's, Play's) are not. */
  numbered?: boolean
  /** An id for a step's tile, by key: what an in-page link to it names (`areaAnchors`). */
  anchors?: Partial<Record<string, string>>
}

const STEPS = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/** The step's frame in its band's colour, through the one hook that colours a frame (R38). */
const frameIn = (band: string) =>
  ({ '--su-compact-frame': band, borderColor: 'var(--su-compact-frame)' }) as CSSProperties

function StepFace({
  step,
  index,
  numbered,
}: {
  step: StartHereStep
  index: number
  numbered: boolean
}) {
  const paint = paintFor(step.tone, { texture: true })
  return (
    <div className="su-entity-index__frame" style={frameIn(paint.background)}>
      {step.art && (
        <div className="su-entity-index__art su-start-here__art">
          <img
            src={step.art.url}
            srcSet={step.art.srcSet}
            sizes={step.art.srcSet ? tileImageSizes() : undefined}
            alt={step.art.alt}
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <div
        className={cn('su-entity-index__band su-start-here__band', grainClass(paint.grain))}
        data-grain={paint.grain}
        style={{ backgroundColor: paint.background, color: paint.color, columnGap: space[6] }}
      >
        {numbered && (
          <span className="su-start-here__number">
            <span className="su-sr-only">{compositionsCopy('step')} </span>
            {index + 1}
          </span>
        )}
        <span className="su-entity-index__notch">
          <h3
            className={cn('su-entity-index__name su-start-here__title', INDEX_NAME_CAPS)}
            style={INDEX_NAME}
          >
            {step.title}
          </h3>
        </span>
        {step.stamp && (
          <span className="su-start-here__stamp">
            <Badge shape="stamp" size="mini" surface="solid">
              {step.stamp}
            </Badge>
          </span>
        )}
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
  numbered = true,
  anchors = {},
}: StartHereProps) {
  return (
    <SlabSection title={title} id={id} as="h2" className="su-start-here" page>
      <ol className="su-start-here__steps" style={STEPS}>
        {steps.map((step, index) => {
          const href = hrefs[step.key]
          return (
            <li key={step.key} id={anchors[step.key]} className="su-start-here__item">
              {href ? (
                <a
                  href={href}
                  className={cn(
                    'su-entity-index su-start-here__step',
                    !step.art && 'su-entity-index--bare',
                    FOCUS_RING
                  )}
                >
                  <StepFace step={step} index={index} numbered={numbered} />
                </a>
              ) : (
                <div className={cn('su-entity-index', !step.art && 'su-entity-index--bare')}>
                  <StepFace step={step} index={index} numbered={numbered} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </SlabSection>
  )
}
