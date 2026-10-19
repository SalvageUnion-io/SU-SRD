import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useContext, useEffect, useRef } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { cn } from '../../../lib/cn'
import { useParseTraitReferences } from '../../../lib/parseTraitReferences'
import { Badge } from '../../atoms/Badge'
import { capsLabel } from '../../atoms/capsLabel'
import { Slab } from '../../atoms/Slab'
import { Callout } from '../../containers/Callout'
import { InsidePeekContext } from '../../entity/peekContext'
import type { CardProseContext } from './CardProse'
import { CardProse } from './CardProse'
import { CardRollTable } from './CardRollTable'
import type { Down } from './cardChrome'
import { PAGE_SLAB } from './cardHelpers'
import { EntityTokenList } from './EntityTokenList'
import { watchGuideContents } from './guideContents'
import { chunkGuideStepProse } from './guideStepProse'
import type { NestedCard } from './referenceEntityCardTypes'
import type { ResolvedGuideStep } from './resolveGuideSteps'

const TOC_TITLE = cn('su-guide__toc-title', capsLabel({ tracking: 'caps' }))
const TOC_SECTION = cn('su-guide__toc-link su-guide__toc-link--section su-hit-area', capsLabel())

/** A step's page pointer, its references as Mentions (E4). */
function GuideNote({ text }: { text: string }) {
  return <p className="su-guide__note">{useParseTraitReferences(text)}</p>
}

/**
 * A step's aside — a tip or a worked example — is the note every rules block
 * draws (hard rule R18): the unlabelled `Callout`, its ink frame on paper,
 * never a left rail (ruleset §3.10), at the guide's reading size. With a
 * `label` ("Note") its stamp rides the frame's top border (StampSeam, §7.2),
 * never a titled head (N5). Only the guide's own Page stamps it. A `note`
 * role, not an `<aside>`: a complementary landmark may not sit inside the
 * page's `main`.
 */
function GuideAside({ text, flavor, label }: { text: string; flavor: boolean; label?: string }) {
  return (
    <Callout
      role="note"
      prose
      className={cn(
        'su-guide__aside',
        flavor && 'su-guide__aside--flavor',
        label && 'su-guide__aside--stamped'
      )}
    >
      {label && (
        <Badge shape="stamp" size="mini" seam className="su-guide__aside-stamp">
          {label}
        </Badge>
      )}
      <p>{useParseTraitReferences(text)}</p>
    </Callout>
  )
}

/**
 * GUIDE STEPS — a guide keeps almost all of its prose in `steps` (28.7k of
 * 34.2k characters across the dataset), so a card that renders only the
 * top-level `content` renders almost none of the guide: the "Salvaging" page
 * was a heading and a source line with all 3.7k characters of its rules
 * missing.
 *
 * The procedure is a real ordered list: each step opens on a solid `Slab` —
 * its numeral, then its name, in the stamp; "Optional" at the rule's end — as
 * every section heading does (ruleset §3.2: slabs section), the home page's
 * "Start here" steps included. A `section` (the book's major divisions,
 * "Post-Session") opens a solid `Slab` above the steps it holds, and numbering
 * restarts inside it. Under each slab: the step's prose, its page pointers
 * as left-aligned notes, its asides (a tip, a worked example) as framed
 * callouts, the entities it selects from as Tokens (a crawler's tech-level
 * ladder too, down its own column), its roll table and any sub-guide as its
 * Token — every one through the primitive its kind already has.
 *
 * Layout is `index.css`'s `.su-guide*`. On a page (`CardPage`'s `guide`) the
 * steps stand beside the prose rather than inside the card body, and take the
 * page's reading size and measure there. There (`page`) a long guide also gets
 * its hierarchy and its way around: a section's slab is the page's H2, every
 * section and step is an anchor, and an "On this page" rail lists them — sticky beside the whole page (the
 * introduction too: the page is `.su-entity-page--guide`'s grid) on a wide
 * screen, an open list under its slab above the steps on a phone. Its prose takes a
 * book measure and leading, and a run-in head's stamp the full rung.
 *
 * Read-only by design: this is the SRD's transcription of the procedure.
 * Walking a guide step by step is Play's job (`PlayDowntimeColumn`),
 * and belongs to the surfaces that own player state (ADR-021).
 */
export function GuideSteps({
  steps,
  prose,
  sectionAs,
  depth,
  isDown,
  compact,
  tableTone,
  chassisName,
  NestedCard,
  page = false,
}: {
  steps: ResolvedGuideStep[]
  prose: CardProseContext
  sectionAs: ElementType | undefined
  /** The HOST card's depth — step entities render one level below it. */
  depth: number
  isDown: Down
  compact: boolean
  /** The guide's own tone, whose band paints its step tables' rows. */
  tableTone?: string
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
  // The contents mark the section in view (`guideContents`); a card served as
  // static HTML runs no effect, so srd's client entry starts it there.
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => (pageRef.current ? watchGuideContents(pageRef.current) : undefined), [])

  const renderStep = ({ step, number, entities, table, subGuide }: ResolvedGuideStep) => {
    const stepProse = chunkGuideStepProse(step.content).map((chunk, index) => {
      if (chunk.kind === 'note') {
        // biome-ignore lint/suspicious/noArrayIndexKey: a step's blocks are static reference content
        return <GuideNote key={index} text={chunk.text} />
      }
      if (chunk.kind === 'aside') {
        return (
          <GuideAside
            // biome-ignore lint/suspicious/noArrayIndexKey: a step's blocks are static reference content
            key={index}
            text={chunk.text}
            flavor={chunk.flavor}
            label={page ? chunk.label : undefined}
          />
        )
      }
      // A run-in head stamps at the full rung beside the page's reading size.
      return (
        <CardProse
          // biome-ignore lint/suspicious/noArrayIndexKey: a step's blocks are static reference content
          key={index}
          body={chunk.blocks}
          context={prose}
          className="su-guide__prose"
          labelStampSize={page ? 'full' : undefined}
        />
      )
    })
    // `sidebar` marks a step whose entities are a progression LADDER (crawler
    // tech levels) rather than a set of options — their Tokens read down a
    // narrow column beside the prose instead of across the page. The prose
    // comes first in the document, so a phone reads it before the ladder it
    // explains.
    const ladder = step.entityLayout === 'sidebar' && entities.length > 0
    let options: ReactNode = null
    if (ladder) {
      options = (
        <div className="su-guide__ladder">
          <div className="su-guide__ladder-prose">{stepProse}</div>
          <div className="su-guide__ladder-cards">
            <EntityTokenList entities={entities} label={step.name} />
          </div>
        </div>
      )
    } else if (entities.length > 0) {
      // A step's options are a big grouping (5 to 21 across the dataset):
      // Tokens, not compact cards (owner's call, 2026-10-14).
      options = (
        <div className="su-guide__cards">
          <EntityTokenList entities={entities} label={step.name} />
        </div>
      )
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
                size={compact ? 'compact' : 'full'}
                disabled={!!isDown}
                tone={tableTone}
              />
            </div>
          )}
          {subGuide && (
            <NestedCard
              size="mini"
              extent="head"
              depth={depth + 1}
              hostDown={isDown}
              data={subGuide}
              chassisName={chassisName}
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
    return (
      <section key={group.key} className="su-guide__section">
        <Slab
          label={group.section}
          as={sectionAs}
          id={anchors?.get(sectionKey(group))}
          className="su-guide__section-head"
          // On its Page the section's gap spaces it (R17), not the slab's margin.
          style={page ? PAGE_SLAB : undefined}
        />
        {list}
      </section>
    )
  })

  if (!anchors) return <div className="su-guide">{body}</div>

  const contents = <GuideContents groups={groups} anchors={anchors} />
  return (
    <div ref={pageRef} className="su-guide su-guide--page">
      {/* A phone lists the contents above the steps, always open under their
          slab; a wide screen sets them in the rail. Only one of the two is
          ever displayed. */}
      <nav className="su-guide__toc-block" aria-label="On this page">
        <Slab label="On this page" style={PAGE_SLAB} />
        {contents}
      </nav>
      <div className="su-guide__flow">{body}</div>
      <nav className="su-guide__rail" aria-label="On this page">
        <p className={TOC_TITLE} aria-hidden="true">
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
            <a className={TOC_SECTION} href={`#${anchors.get(sectionKey(group))}`}>
              {group.section}
            </a>
            {stepLinks(group)}
          </li>
        )
      )}
    </ul>
  )
}

/** A step's slab sits flush: the step's own gap spaces it, not the slab's margin. */
const STEP_SLAB = { marginBottom: 0 } satisfies CSSProperties

/**
 * A step's slab: a two-cell chip, its numeral on the ink and its name on a
 * paper cell (`9 | CHOOSE YOUR APPEARANCE`); "Optional" at the rule's end.
 */
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
  return (
    <Slab
      as={as ?? 'div'}
      id={id}
      className="su-guide__head"
      style={STEP_SLAB}
      label={
        <>
          {number} <span className="su-guide__step-name">{name}</span>
        </>
      }
      count={optional ? 'Optional' : undefined}
    />
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
