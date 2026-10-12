import type { ElementType, ReactNode } from 'react'
import { useContext } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { InsidePeekContext } from '../../../entity/peekContext'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { Badge } from '../../atoms/Badge'
import { Slab } from '../../atoms/Slab'
import type { CardProseContext } from './CardProse'
import { CardProse } from './CardProse'
import { CardRollTable } from './CardRollTable'
import { grainStyle } from './cardGrain'
import { cardKey } from './cardHelpers'
import { chunkGuideStepProse } from './guideStepProse'
import type { NestedCard } from './referenceEntityCardTypes'
import type { ResolvedGuideStep } from './resolveGuideSteps'

/** A step's page pointer, its references as Mentions (E4). */
function GuideNote({ text }: { text: string }) {
  return <p className="su-guide__note">{useParseTraitReferences(text)}</p>
}

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
 * page's reading size and measure there. There (`page`) a long guide also gets
 * its hierarchy and its way around: a section opens on an H2-scale head (the
 * book's division, not a 12px stamp), every section and step is an anchor, and
 * an "On this page" rail lists them — sticky in the page's empty right third
 * on a wide screen, a folded disclosure above the steps on a phone.
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
  page = false,
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
  /** The guide is its own page: H2 section heads, anchors and the rail. */
  page?: boolean
}) {
  // Terminal in a tooltip popup (ruleset §1): the step table carries controls.
  const insidePeek = useContext(InsidePeekContext)
  const groups = groupBySection(steps)
  // With sections, a step heads one level below its section's slab.
  const hasSections = groups.some((group) => group.section !== undefined)
  const stepAs = hasSections ? headingBelow(sectionAs) : sectionAs
  const anchors = page ? guideAnchors(groups) : undefined

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
        <GuideNote key={index} text={chunk.text} />
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
        <StepHead
          as={stepAs}
          id={anchors?.get(step.id)}
          number={number}
          name={step.name}
          optional={step.optional}
        />
        <div className="su-guide__body">
          {!ladder && stepProse}
          {options}
          {/* The step's table: the same embedded table an entity owns (board
              E4), framed because it sits on the page; a wide one scrolls in
              its own box rather than pushing the page sideways. */}
          {table && !insidePeek && (
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

  const body = groups.map((group) => {
    const list = <ol className="su-guide__steps">{group.steps.map(renderStep)}</ol>
    if (group.section === undefined) {
      return <div key={group.key}>{list}</div>
    }
    const SectionHead = sectionAs ?? 'div'
    return (
      <section key={group.key} className="su-guide__section">
        {page ? (
          <SectionHead id={anchors?.get(sectionKey(group))} className="su-guide__section-head">
            {group.section}
          </SectionHead>
        ) : (
          <Slab variant="solid" label={group.section} as={sectionAs} />
        )}
        {list}
      </section>
    )
  })

  if (!anchors) return <div className="su-guide">{body}</div>

  const contents = <GuideContents groups={groups} anchors={anchors} />
  return (
    <div className="su-guide su-guide--page">
      {/* A phone folds the contents above the steps; a wide screen sets them
          in the rail. Only one of the two is ever displayed. */}
      <details className="su-guide__toc-fold">
        <summary className="su-guide__toc-summary">On this page</summary>
        {contents}
      </details>
      <div className="su-guide__flow">{body}</div>
      <nav className="su-guide__rail" aria-label="On this page">
        <p className="su-guide__toc-title" aria-hidden="true">
          On this page
        </p>
        {contents}
      </nav>
    </div>
  )
}

/** A section's anchor key: its group's key is its first step's id. */
const sectionKey = (group: StepGroup) => `section:${group.key}`

/**
 * Each section's and step's anchor, keyed by `sectionKey` or the step's id:
 * the name as a slug, numbered on a repeat so every id is unique.
 */
function guideAnchors(groups: StepGroup[]): Map<string, string> {
  const anchors = new Map<string, string>()
  const used = new Map<string, number>()
  const claim = (key: string, name: string) => {
    const base = nameToSlug(name) || 'step'
    const count = (used.get(base) ?? 0) + 1
    used.set(base, count)
    anchors.set(key, count === 1 ? base : `${base}-${count}`)
  }
  for (const group of groups) {
    if (group.section !== undefined) claim(sectionKey(group), group.section)
    for (const { step } of group.steps) claim(step.id, step.name)
  }
  return anchors
}

/**
 * The rail's list: each section, then its numbered steps. Each link takes the
 * 44px coarse-pointer floor through the shared hit area (ruleset §4.6), so the
 * list keeps its reading rhythm.
 */
function GuideContents({ groups, anchors }: { groups: StepGroup[]; anchors: Map<string, string> }) {
  const stepLinks = (group: StepGroup) => (
    <ol className="su-guide__toc-steps">
      {group.steps.map(({ step, number }) => (
        <li key={step.id}>
          <a className="su-guide__toc-link su-hit-area" href={`#${anchors.get(step.id)}`}>
            <span className="su-guide__toc-num">{number}</span>
            {step.name}
          </a>
        </li>
      ))}
    </ol>
  )
  return (
    <ul className="su-guide__toc">
      {groups.map((group) =>
        group.section === undefined ? (
          <li key={group.key}>{stepLinks(group)}</li>
        ) : (
          <li key={group.key}>
            <a
              className="su-guide__toc-link su-guide__toc-link--section su-hit-area"
              href={`#${anchors.get(sectionKey(group))}`}
            >
              {group.section}
            </a>
            {stepLinks(group)}
          </li>
        )
      )}
    </ul>
  )
}

/** A step's banner: the ink how-to head, its numeral, then its name. */
function StepHead({
  as,
  id,
  number,
  name,
  optional,
}: {
  as: ElementType | undefined
  id: string | undefined
  number: number
  name: string
  optional: boolean | undefined
}) {
  const Heading = as ?? 'div'
  return (
    <Heading id={id} className="su-guide__head" style={grainStyle('paper')}>
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
