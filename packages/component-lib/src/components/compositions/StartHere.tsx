import type { CSSProperties } from 'react'
import { borderWidth, color, font, fontSize, space } from '../../design/tokens'
import { FOCUS_RING } from '../atoms/interaction'
import { Slab } from '../atoms/Slab'

/**
 * StartHere — the one onboarding both fronts show: the SRD's home and ITUN's
 * front door. Three steps in the order a new crew walks them, each headed by a
 * solid `Slab` — its numeral, then its title, in the stamp, as every section
 * heading is (ruleset §3.2) — then one line on what the step is. The steps' words are `START_HERE_STEPS`, spelled
 * once here, so the two tools cannot drift into two onboardings again.
 *
 * What each tool adds is a prop: an `href` per step (the SRD opens the book's
 * creation guide; ITUN, signed out, has nowhere to send them yet).
 *
 * The three steps are one box, with no rules between them: stacked in the SRD's
 * 20rem sidebar and on a phone, three across once the box is 48rem wide
 * (ITUN's front door) — the `.su-start-here__steps` container query.
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
}

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
} satisfies CSSProperties

/** The one box the three steps share. */
const STEPS = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const STEP = {
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  paddingBottom: space[16],
  textDecoration: 'none',
} satisfies CSSProperties

/** The step's slab, inset from the box's frame. */
const STEP_SLAB = {
  marginBottom: space[8],
  paddingInline: space[16],
  paddingTop: space[16],
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
      <Slab
        variant="solid"
        as="h3"
        className="su-start-here__title"
        style={STEP_SLAB}
        label={
          <>
            <span aria-hidden="true">{index + 1}</span> {step.title}
          </>
        }
      />
      <p style={BODY}>{step.body}</p>
    </>
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
            <li key={step.key}>
              {href ? (
                <a href={href} className={`su-start-here__step ${FOCUS_RING}`} style={STEP}>
                  <StepFace step={step} index={index} />
                </a>
              ) : (
                <div style={STEP}>
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
