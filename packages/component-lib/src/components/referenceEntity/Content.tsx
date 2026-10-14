import type { CSSProperties } from 'react'
import type { SURefObjectContentBlock, SURefObjectDataValue } from 'salvageunion-reference'
import { glossaryRef, parseContentBlockString } from 'salvageunion-reference'
import { statesMechanicalChange } from 'salvageunion-reference/rules'
import { space, fontSize as typeScale, weight } from '../../design/tokens'
import { useAppliesRules } from '../../entity/entitySurfaceContext'
import { PeekCell } from '../../entity/parts/PeekCell'
import { Tag } from '../../entity/parts/Tags'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { ActivationCost } from '../atoms/ActivationCost'
import { Badge } from '../atoms/Badge'
import { Slab } from '../atoms/Slab'
import { Stat } from '../atoms/Stat'
import { Text } from '../atoms/Text'

/**
 * The reading size a `Content` run is set in.
 *
 * `xs` / `sm` are the inherited `text-xs` / `text-sm` rungs WITH their paired
 * line heights: the utilities this replaces set both, and — merged after
 * `Text`'s own `leading-snug` — the class merge dropped the snug leading, so
 * the rung's line height is what rendered. `inherit` sets nothing, leaving the
 * page's reading size and `Text`'s snug leading in charge.
 */
export type ContentFontSize = 'xs' | 'sm' | 'inherit'

const FONT_SIZE_STYLE: Record<ContentFontSize, CSSProperties> = {
  xs: { fontSize: typeScale.xs, lineHeight: '1rem' },
  sm: { fontSize: typeScale.sm, lineHeight: '1.25rem' },
  inherit: {},
}

const breakWord = { overflowWrap: 'break-word' } satisfies CSSProperties

const sectionStyle = { marginTop: space[8] } satisfies CSSProperties

const dataValuesStyle = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[4],
} satisfies CSSProperties

/** The AUTO stamp's seat at the head of a rules-bearing paragraph: on the line, before the words. */
const autoStampStyle = {
  marginRight: space[6],
  verticalAlign: 'text-bottom',
} satisfies CSSProperties

/** What the AUTO stamp says, to a pointer's hover and to a screen reader. */
const AUTO_NOTE = 'The app applies this rule'

const listItemStyle = {
  display: 'flex',
  gap: space[8],
  marginBottom: space[4],
} satisfies CSSProperties

const labelStampStyle = { display: 'block', marginBottom: space[4] } satisfies CSSProperties

/** A measured keyword wears the chip label an action's own facet does
 *  (`traits.ts`), so "Damage | 5 SP" in prose reads DMG like every attack. */
const MEASURED_KEYWORD_SHORT: Record<string, string> = { Damage: 'DMG', Range: 'RNG' }

/**
 * A single `datavalues` item. A `cost` item ("3 AP") uses the ActivationCost
 * atom. A CITATION of a named rule — a trait ("Missile", "Explosive (1)", the
 * book's qualified form) or a label-only keyword ("Turn Action") — is a Tag
 * (ruleset §3.2: tags cite), linking to its entry and Peeking it. Anything
 * with a `label | value` — a measured keyword ("Damage | 2 SP") included — is
 * a horizontal Stat (§3.7), Peeking its keyword.
 */
function DataValueChip({ item, compact }: { item: SURefObjectDataValue; compact?: boolean }) {
  if (item.type === 'cost') {
    let cost: string | number = item.label
    let currency = item.value
    if (!currency && typeof item.label === 'string') {
      const parts = item.label.trim().split(/\s+/)
      const last = parts[parts.length - 1]
      if (last === 'AP' || last === 'EP' || last === 'XP') {
        cost = parts.slice(0, -1).join(' ')
        currency = last
      }
    }
    return <ActivationCost cost={cost} currency={currency} compact={compact} />
  }
  const value = item.value != null && item.unit ? `${item.value} ${item.unit}` : item.value
  if (item.type === 'trait' || (item.type === 'keyword' && value == null)) {
    // A citation of a rule is a TAG (E9, E17): its name, its parameter cell,
    // and its entry's page and Peek.
    const schemaName = item.type === 'trait' ? ('traits' as const) : ('keywords' as const)
    const name = String(item.label)
    const ref = glossaryRef(schemaName, name)
    return (
      <Tag
        linkable
        tag={{
          key: `${schemaName}-${name}`,
          name,
          ...(value == null ? {} : { param: String(value) }),
          schemaName,
          ...(ref ? { ref } : {}),
        }}
      />
    )
  }
  const peek = item.type === 'keyword' ? glossaryRef('keywords', String(item.label)) : undefined
  return (
    <PeekCell peek={peek}>
      <Stat
        orientation="horizontal"
        label={
          (item.type === 'keyword' && MEASURED_KEYWORD_SHORT[String(item.label)]) || item.label
        }
        value={value}
        size={compact ? 'compact' : 'full'}
        inline={false}
      />
    </PeekCell>
  )
}

type ContentProps = {
  /** The content blocks to render. */
  body: SURefObjectContentBlock[]
  /** Reading size for the content (`'inherit'` keeps the page's own). */
  fontSize?: ContentFontSize
  /** Whether to use compact styling */
  compact?: boolean
  /** Chassis name to replace [(CHASSIS)] placeholder with */
  chassisName?: string
  /** Group blocks into sections, each heading/datavalues block leading one.
   * Opt-in: without it the blocks render as one flat flow. */
  grouped?: boolean
  /**
   * True when the owning record carries structured data for the mechanical
   * change its text states (ADR-029).
   *
   * When set, and the surface applies the rules (`appliesRules`: ITUN), a
   * paragraph that STATES a mechanical change leads with an ink AUTO stamp —
   * the reader can see which clause the app actually applies, adjacent to the
   * claim itself. Prose that states a change on a record with no data stays
   * unmarked, so a coverage gap is visible in the product and not only in CI.
   * The SRD applies nothing, so it prints the same paragraph as plain prose.
   */
  rulesBearing?: boolean
  /** A class on the run's root (a guide step's `su-guide__prose`). */
  className?: string
  /**
   * The rung a `label` block's stamp takes: `compact` (default) beside card
   * prose; `full` beside a page's reading size (a guide step's run-in head).
   */
  labelStampSize?: 'compact' | 'full'
}

/**
 * View-only component for rendering an array of content blocks
 * Handles different content block types:
 * - paragraph: Regular text with trait reference parsing
 * - heading: Semantic heading elements (h3-h5) with pseudoheader styling and level-based sizing
 * - list-item: Bulleted list item
 * - list-item-naked: List item without bullet
 * - label: Labeled content
 * - hint: Italic text for hints/tips
 * - datavalues: Array of data values rendered as compact flex row (value is array of dataValue objects)
 */
export function Content({
  body: rawContent,
  fontSize = 'sm',
  compact = false,
  chassisName,
  rulesBearing = false,
  grouped = false,
  className,
  labelStampSize = 'compact',
}: ContentProps) {
  if (!rawContent || rawContent.length === 0) {
    return null
  }

  // `choice` blocks are position markers consumed by interleaving-aware renderers
  // (the NEW card's editable walk); they carry no display content, so strip them
  // here — read-only output is identical to data without them.
  const content = rawContent.filter((b) => b?.type !== 'choice')
  if (content.length === 0) {
    return null
  }

  // Section grouping (heading/datavalues blocks start a new section with top
  // spacing) is opt-in: without `grouped` the blocks render as one flat flow.
  const groupSections = grouped

  // Group content blocks into sections: blocks before any heading/datavalues are ungrouped,
  // each heading or datavalues block starts a new section
  const sectionStarters = new Set(['heading', 'datavalues'])
  const sections: {
    startsSection: boolean
    blocks: { block: SURefObjectContentBlock; originalIndex: number }[]
  }[] = []
  let current: {
    startsSection: boolean
    blocks: { block: SURefObjectContentBlock; originalIndex: number }[]
  } = { startsSection: false, blocks: [] }

  for (let i = 0; i < content.length; i++) {
    const block = content[i]
    if (!block) continue
    if (block.type && sectionStarters.has(block.type) && groupSections) {
      // Push current section if it has blocks
      if (current.blocks.length > 0) {
        sections.push(current)
      }
      // Start a new section
      current = { startsSection: true, blocks: [{ block, originalIndex: i }] }
    } else {
      current.blocks.push({ block, originalIndex: i })
    }
  }
  if (current.blocks.length > 0) {
    sections.push(current)
  }

  return (
    <div className={className}>
      {sections.map((section) => {
        if (!section.startsSection) {
          return section.blocks.map(({ block, originalIndex }) => (
            <ContentBlock
              key={originalIndex}
              block={block}
              fontSize={fontSize}
              compact={compact}
              chassisName={chassisName}
              rulesBearing={rulesBearing}
              labelStampSize={labelStampSize}
            />
          ))
        }

        // Separate the leading heading or datavalues label from the bordered content
        const firstBlock = section.blocks[0]
        const isLeadingHeading = firstBlock?.block.type === 'heading'
        const hasDatavaluesLabel = firstBlock?.block.type === 'datavalues' && firstBlock.block.label
        const labelText = isLeadingHeading
          ? null
          : hasDatavaluesLabel
            ? firstBlock.block.label
            : null
        const headingBlock = isLeadingHeading ? firstBlock : null
        const contentBlocks = isLeadingHeading ? section.blocks.slice(1) : section.blocks

        return (
          <div key={`section-${firstBlock?.originalIndex ?? -1}`} style={sectionStyle}>
            {headingBlock && (
              <ContentBlock
                block={headingBlock.block}
                fontSize={fontSize}
                compact={compact}
                chassisName={chassisName}
                rulesBearing={rulesBearing}
                labelStampSize={labelStampSize}
              />
            )}
            {labelText && (
              <Text
                variant="body"
                as="div"
                style={{ marginBottom: space[8], ...FONT_SIZE_STYLE[fontSize] }}
              >
                {labelText}
              </Text>
            )}
            {contentBlocks.length > 0 && (
              <div>
                {contentBlocks.map(({ block, originalIndex }) => (
                  <ContentBlock
                    key={originalIndex}
                    block={block}
                    fontSize={fontSize}
                    compact={compact}
                    rulesBearing={rulesBearing}
                    chassisName={chassisName}
                    labelStampSize={labelStampSize}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ContentBlock({
  block,
  fontSize,
  compact,
  chassisName,
  rulesBearing = false,
  labelStampSize = 'compact',
}: {
  block: SURefObjectContentBlock
  fontSize: ContentFontSize
  compact: boolean
  chassisName?: string
  /** See `ContentProps.rulesBearing`. */
  rulesBearing?: boolean
  /** See `ContentProps.labelStampSize`. */
  labelStampSize?: 'compact' | 'full'
}) {
  const type = block.type || 'paragraph'
  const blockValue = block.value
  const sizeStyle = FONT_SIZE_STYLE[fontSize]
  const appliesRules = useAppliesRules()

  // Always parse the string value for the hook (even if we don't use it for datavalues)
  // This ensures React hooks are called in the same order every render
  const stringValue = parseContentBlockString(block, chassisName)
  const parsedValue = useParseTraitReferences(stringValue)

  // Handle datavalues type - value is an array of dataValue objects
  if (type === 'datavalues') {
    if (!Array.isArray(blockValue) || blockValue.length === 0) {
      return null
    }
    return (
      <div style={dataValuesStyle}>
        {blockValue.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: datavalues come from static reference content blocks and never reorder
          <DataValueChip key={index} item={item} compact={compact} />
        ))}
      </div>
    )
  }

  switch (type) {
    case 'paragraph': {
      // Mark the clause the app actually understands. Paragraph granularity is
      // deliberate: the trait parser has already turned this text into a node
      // array, so splicing a sentence-level mark back into it would be fragile
      // for no gain — these paragraphs are one or two sentences.
      const bearing = appliesRules && rulesBearing && statesMechanicalChange(stringValue) !== null
      return (
        <Text
          variant="body"
          as="div"
          style={{ marginBottom: space[4], ...sizeStyle, ...breakWord }}
          {...(bearing ? { 'data-rules-bearing': 'true' } : {})}
        >
          {bearing && (
            <Badge shape="stamp" size="mini" title={AUTO_NOTE} style={autoStampStyle}>
              Auto<span className="su-sr-only">: {AUTO_NOTE.toLowerCase()}.</span>
            </Badge>
          )}
          {parsedValue}
        </Text>
      )
    }

    case 'heading': {
      // Section headings render as the canonical Slab separator — a level-1
      // heading takes the solid poster-stamp shape, sub-levels the dashed rule.
      const level = block.level || 3
      return <Slab variant={level === 1 ? 'solid' : 'dashed'} label={stringValue} />
    }

    case 'list-item': {
      // A plain hanging `- ` list item — no bordered frame. Labelled items (e.g.
      // NPC motivations) lead with a bold label; unlabelled bullets (e.g. "one of
      // the following" effect options) are just the dash + body. The flex + gap
      // gives a hanging indent so wrapped lines align under the text, not the dash.
      return (
        <div style={{ ...listItemStyle, ...sizeStyle }}>
          <span aria-hidden style={{ userSelect: 'none' }}>
            -
          </span>
          <Text variant="body" as="div" style={{ flex: 1, ...sizeStyle, ...breakWord }}>
            {block.label ? (
              <span style={{ fontWeight: weight.bold }}>{String(block.label)}: </span>
            ) : null}
            {parsedValue}
          </Text>
        </div>
      )
    }
    case 'hint':
      return (
        <Text variant="hint" as="div" style={{ ...sizeStyle, ...breakWord }}>
          {parsedValue}
        </Text>
      )

    case 'flavor':
      return (
        <Text
          variant="flavor"
          as="div"
          data-prose="flavor"
          style={{ marginBottom: space[4], ...sizeStyle, ...breakWord }}
        >
          {parsedValue}
        </Text>
      )

    case 'label':
      return (
        <div>
          {block.label && (
            <Badge shape="stamp" size={labelStampSize} style={labelStampStyle}>
              {block.label}
            </Badge>
          )}
          <Text variant="body" as="div" style={sizeStyle}>
            {parsedValue}
          </Text>
        </div>
      )

    default:
      // Fallback for unknown types — render as body prose.
      return (
        <Text variant="body" as="div" style={sizeStyle}>
          {parsedValue}
        </Text>
      )
  }
}
