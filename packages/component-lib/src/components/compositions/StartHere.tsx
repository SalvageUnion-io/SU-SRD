import type { CSSProperties, ElementType, ReactNode } from 'react'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { FOCUS_RING } from '../atoms/interaction'
import { Slab } from '../atoms/Slab'

/**
 * StartHere — the one onboarding both fronts show: the SRD's home and ITUN's
 * front door. Three steps in the order a new crew walks them, each an ink
 * banner with its numeral and the book's rounded tail (ruleset §4.4), then one
 * line on what the step is. The steps' words are `START_HERE_STEPS`, spelled
 * once here, so the two tools cannot drift into two onboardings again.
 *
 * What each tool adds is props: an `href` per step (the SRD opens the book's
 * creation guide; ITUN, signed out, has nowhere to send them yet) and its own
 * way on in `children`, under the steps.
 *
 * The steps sit in as many ~16rem columns as there is room for: one in the
 * SRD's 20rem sidebar, three across ITUN's front door.
 */

type StartHereStepKey = 'pilot' | 'mech' | 'crawler'

type StartHereStep = { key: StartHereStepKey; title: string; body: string }

/** The three steps, in order. Playing a Game happens from the Crawler, so it is not a step. */
const START_HERE_STEPS: readonly StartHereStep[] = [
  {
    key: 'pilot',
    title: 'Create a Pilot',
    body: 'Pick a class and your first ability, then add a keepsake, motto and background.',
  },
  {
    key: 'mech',
    title: 'Create a Mech',
    body: 'Choose a chassis and pattern, then fill its system and module slots.',
  },
  {
    key: 'crawler',
    title: 'Join or make a Crawler',
    body: 'Your crew shares one Union Crawler. Make it, or open the invite link a crewmate sends you to join their Game.',
  },
]

type StartHereProps = {
  /** The heading's id, which names the section. */
  id: string
  /** Where each step opens, by key. A step without one is not a link. */
  hrefs?: Partial<Record<StartHereStepKey, string>>
  /** Link component for the steps' hrefs. Defaults to a plain anchor. */
  LinkComponent?: ElementType
  /** The tool's own way on, under the steps. */
  children?: ReactNode
}

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
} satisfies CSSProperties

const STEPS = {
  alignItems: 'stretch',
  display: 'grid',
  gap: space[12],
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const STEP = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  paddingBottom: space[16],
  textDecoration: 'none',
} satisfies CSSProperties

/** The step's ink banner, square on the left and rounded off on the right. */
const BANNER = {
  alignItems: 'center',
  backgroundColor: color.ink,
  borderEndEndRadius: radius.full,
  borderStartEndRadius: radius.full,
  color: color.paper,
  display: 'flex',
  gap: space[10],
  margin: `${space[12]} ${space[24]} ${space[12]} 0`,
  minHeight: '44px',
  padding: `${space[6]} ${space[16]} ${space[6]} ${space[12]}`,
} satisfies CSSProperties

const NUMERAL = {
  fontFamily: font.cond,
  fontSize: fontSize.displayLg,
  fontWeight: weight.extrabold,
  lineHeight: 1,
} satisfies CSSProperties

const TITLE = {
  fontFamily: font.cond,
  fontSize: fontSize.title,
  fontWeight: weight.bold,
  letterSpacing: 'normal',
  lineHeight: 1.1,
  margin: 0,
  // Set, not inherited: ITUN's base heading rule capitalises every heading,
  // and the block reads the same on both fronts.
  textTransform: 'none',
} satisfies CSSProperties

const BODY = {
  fontFamily: font.body,
  fontSize: fontSize.lede,
  lineHeight: 1.55,
  margin: 0,
  paddingInline: space[16],
} satisfies CSSProperties

function StepFace({ step, index }: { step: StartHereStep; index: number }) {
  return (
    <>
      <div style={BANNER}>
        <span aria-hidden="true" style={NUMERAL}>
          {index + 1}
        </span>
        <h3 className="su-start-here__title" style={TITLE}>
          {step.title}
        </h3>
      </div>
      <p style={BODY}>{step.body}</p>
    </>
  )
}

export function StartHere({ id, hrefs = {}, LinkComponent = 'a', children }: StartHereProps) {
  return (
    <section aria-labelledby={id} style={SECTION}>
      <Slab label="Start here" id={id} as="h2" variant="solid" style={{ marginBottom: 0 }} />
      <ol style={STEPS}>
        {START_HERE_STEPS.map((step, index) => {
          const href = hrefs[step.key]
          return (
            <li key={step.key}>
              {href ? (
                <LinkComponent
                  href={href}
                  className={`su-start-here__step ${FOCUS_RING}`}
                  style={STEP}
                >
                  <StepFace step={step} index={index} />
                </LinkComponent>
              ) : (
                <div style={STEP}>
                  <StepFace step={step} index={index} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {children}
    </section>
  )
}
