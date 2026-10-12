import type { ElementType, ReactNode } from 'react'
import { useContext } from 'react'
import { Badge } from '../../chrome/Badge'
import { Slab } from '../../chrome/Slab'
import { InsideTooltipContext } from '../../ui/insideTooltipContext'
import type { CardProseContext } from './CardProse'
import { CardProse } from './CardProse'
import { CardRollTable } from './CardRollTable'
import { grainStyle } from './cardGrain'
import { cardKey } from './cardHelpers'
import { chunkGuideStepProse } from './guideStepProse'
import type { NestedCard } from './referenceEntityCardTypes'
import type { ResolvedGuideStep } from './resolveGuideSteps'

/**
 * GUIDE STEPS — a guide keeps almost all of its prose in `steps` (28.7k of
 * 34.2k characters across the dataset), so a card that renders only the
 * top-level `content` renders almost none of the guide: the "Salvaging" page
 * was a heading and a source line with all 3.7k characters of its rules
 * missing.
 *
 * The procedure is a real ordered list, drawn the way the book draws a
 * how-to: each step opens on an ink banner with a rounded tail — its numeral,
 * then its name (ruleset §4.4 names "the how-to cards on Guides" as one of the
 * two places rounding copies the book) — the same device as the home page's
 * "New to the Union?" steps. A `section` (the book's major divisions,
 * "Post-Session") opens a solid `Slab` above the steps it holds, and numbering
 * restarts inside it. Under each banner: the step's prose, its page pointers
 * as left-aligned notes, the entities it selects from as compact cards, its
 * roll table and any sub-guide — every one through the primitive its kind
 * already has.
 *
 * Layout is `index.css`'s `.su-guide*`. On a page (`CardPage`'s `guide`) the
 * steps stand beside the prose rather than inside the card body, and take the
 * page's reading size and measure there.
 *
 * Read-only by design: this is the SRD's transcription of the procedure.
 * Walking a guide as an interactive wizard is ITUN's job (`DowntimeWizard`),
 * and belongs to the surfaces that own player state (ADR-021).
 */
export function GuideSteps({
  steps,
  prose,
  sectionAs,
  depth,
  isDown,
  compact,
  collapsibleTables,
  chassisName,
  NestedCard,
}: {
  steps: ResolvedGuideStep[]
  prose: CardProseContext
  sectionAs: ElementType | undefined
  /** The HOST card's depth — step entities render one level below it. */
  depth: number
  isDown: boolean
  compact: boolean
  /** A catalog tile or nested card gets its tables collapsible. */
  collapsibleTables: boolean
  chassisName: string | undefined
  NestedCard: NestedCard
}) {
  // Terminal in a tooltip popup (ruleset §1): the step table carries controls.
  const insideTooltip = useContext(InsideTooltipContext)
  const groups = groupBySection(steps)
  // With sections, a step heads one level below its section's slab.
  const hasSections = groups.some((group) => group.section !== undefined)
  const stepAs = hasSections ? headingBelow(sectionAs) : sectionAs

  const renderStep = ({ step, number, entities, table, subGuide }: ResolvedGuideStep) => {
    const card = (option: (typeof entities)[number], index: number) => (
      <NestedCard
        key={cardKey(option, index)}
        size="medium"
        extent="head"
        depth={depth + 1}
        hostDown={isDown}
        data={option}
        chassisName={chassisName}
      />
    )
    const stepProse = chunkGuideStepProse(step.content).map((chunk, index) =>
      chunk.kind === 'note' ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: a step's blocks are static reference content
        <p key={index} className="su-guide__note">
          {chunk.text}
        </p>
      ) : (
        // biome-ignore lint/suspicious/noArrayIndexKey: a step's blocks are static reference content
        <CardProse key={index} body={chunk.blocks} context={prose} />
      )
    )
    // `sidebar` marks a step whose entities are a progression LADDER (crawler
    // tech levels) rather than a set of options — they read down a narrow
    // column beside the prose instead of across a grid. The prose comes first
    // in the document, so a phone reads it before the ladder it explains.
    const ladder = step.entityLayout === 'sidebar' && entities.length > 0
    let options: ReactNode = null
    if (ladder) {
      options = (
        <div className="su-guide__ladder">
          <div className="su-guide__ladder-prose">{stepProse}</div>
          <div className="su-guide__ladder-cards">{entities.map(card)}</div>
        </div>
      )
    } else if (entities.length > 0) {
      options = <div className="su-guide__cards">{entities.map(card)}</div>
    }
    return (
      <li key={step.id} className="su-guide__step" data-optional={step.optional || undefined}>
        <StepHead as={stepAs} number={number} name={step.name} optional={step.optional} />
        <div className="su-guide__body">
          {!ladder && stepProse}
          {options}
          {/* The step's table: the same embedded table an entity owns (board
              E4), framed because it sits on the page; a wide one scrolls in
              its own box rather than pushing the page sideways. */}
          {table && !insideTooltip && (
            <div className="su-guide__table">
              <CardRollTable
                table={table.table}
                name={table.name}
                size={compact ? 'medium' : 'large'}
                collapsible={collapsibleTables}
                disabled={isDown}
                framed
              />
            </div>
          )}
          {subGuide && (
            <NestedCard
              size="medium"
              extent="head"
              depth={depth + 1}
              hostDown={isDown}
              data={subGuide}
            />
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="su-guide">
      {groups.map((group) => {
        const list = <ol className="su-guide__steps">{group.steps.map(renderStep)}</ol>
        if (group.section === undefined) {
          return <div key={group.key}>{list}</div>
        }
        return (
          <section key={group.key} className="su-guide__section">
            <Slab variant="solid" label={group.section} as={sectionAs} />
            {list}
          </section>
        )
      })}
    </div>
  )
}

/** A step's banner: the ink how-to head, its numeral, then its name. */
function StepHead({
  as,
  number,
  name,
  optional,
}: {
  as: ElementType | undefined
  number: number
  name: string
  optional: boolean | undefined
}) {
  const Heading = as ?? 'div'
  return (
    <Heading className="su-guide__head" style={grainStyle('paper')}>
      <span className="su-guide__num">{number}</span>
      <span className="su-guide__name">{name}</span>
      {optional && (
        <Badge shape="stamp" surface="inverse" size="compact">
          Optional
        </Badge>
      )}
    </Heading>
  )
}

type StepGroup = { key: string; section?: string; steps: ResolvedGuideStep[] }

/**
 * The steps under each `section` label, in order. Steps before the first
 * label (every guide but Crawler Downtime) form one unlabelled group.
 */
function groupBySection(steps: ResolvedGuideStep[]): StepGroup[] {
  const groups: StepGroup[] = []
  for (const entry of steps) {
    const current = groups[groups.length - 1]
    if (entry.section !== undefined || !current) {
      groups.push({ key: entry.step.id, section: entry.section, steps: [entry] })
    } else {
      current.steps.push(entry)
    }
  }
  return groups
}

/** The heading one level below `as` (`h2` → `h3`); anything else unchanged. */
const HEADING_BELOW: Record<string, ElementType> = {
  h1: 'h2',
  h2: 'h3',
  h3: 'h4',
  h4: 'h5',
  h5: 'h6',
}
function headingBelow(as: ElementType | undefined): ElementType | undefined {
  return typeof as === 'string' ? (HEADING_BELOW[as] ?? as) : as
}
