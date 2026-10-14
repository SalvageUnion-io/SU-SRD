/**
 * The card's prose bands — every place `ReferenceEntityCard` hands content
 * blocks to `Content`, sharing ONE set of card-derived props so the five call
 * sites cannot drift.
 */

import type { CSSProperties } from 'react'
import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { Slab } from '../../atoms/Slab'
import type { ContentFontSize } from '../Content'
import { Content } from '../Content'
import { stripHostParenthetical } from './stripHostParenthetical'

/** A named prose block: its name tab over its prose. The block's bottom
 *  margin (`.su-ec-block`) is a class: it drops on the last child. */
const STACK = { display: 'flex', flexDirection: 'column', gap: space[6] } satisfies CSSProperties

/** The card context every prose band renders with. */
export type CardProseContext = {
  /** Whether the card's record carries structured data for its prose (ADR-029). */
  rulesBearing: boolean
  compact: boolean
  /** Resolves `[(CHASSIS)]` tokens. */
  chassisName: string | undefined
  /** The card's tone as a CSS colour (a guide's own tone wins). */
  toneColor: string | undefined
  /** Overrides the compact/regular size. A page's prose passes `'inherit'` so it
   * inherits `.su-entity-page__prose`'s reading size; a leaf size would beat the
   * inherited one. */
  fontSize?: ContentFontSize
}

/** A run of content blocks, rendered in the card's own prose styling. */
export function CardProse({
  body,
  context,
  className,
  labelStampSize,
}: {
  body: SURefObjectContentBlock[]
  context: CardProseContext
  /** A class on the run's root, for a surface that sets its own reading rhythm. */
  className?: string
  /** A `label` block's stamp rung (`Content`'s `labelStampSize`). */
  labelStampSize?: 'compact' | 'full'
}) {
  return (
    <Content
      className={className}
      labelStampSize={labelStampSize}
      rulesBearing={context.rulesBearing}
      body={body}
      compact={context.compact}
      chassisName={context.chassisName}
      fontSize={context.fontSize ?? (context.compact ? 'xs' : 'sm')}
      grouped={Boolean(context.toneColor)}
    />
  )
}

/**
 * A folded action's prose, when the action is NOT the entity's self-action (a
 * self-action's content already renders AS the body).
 *
 * The folded action keeps its NAME as a left-anchored Slab stamp ONLY when it
 * differs from the entity — a same-named action (e.g. Grenade's own "Grenade"
 * action) would be redundant noise.
 */
export function FoldedActionProse({
  action,
  entityName,
  content,
  context,
}: {
  action: { name?: string; displayName?: string }
  entityName: string
  content: SURefObjectContentBlock[]
  context: CardProseContext
}) {
  return (
    <div className="su-ec-block" style={STACK}>
      {action.name && action.name !== entityName && (
        <Slab
          variant="solid"
          label={stripHostParenthetical(action.displayName ?? action.name, entityName)}
        />
      )}
      <CardProse body={content} context={context} />
    </div>
  )
}

/**
 * PATTERN PROSE — the pattern's OWN flavour, name-tabbed like a folded
 * action's prose so it can't be mistaken for the chassis prose that leads the
 * body. It renders ahead of the loadout groups, so a pattern view reads
 * chassis → pattern → systems → modules (a pattern PAGE sets the chassis
 * ability before its loadout). (A `head` pattern row surfaces this same text as its
 * header hint and returns before the body, so it never doubles up.)
 */
export function PatternProse({
  name,
  content,
  context,
  onPage = false,
  note,
}: {
  name: string
  content: SURefObjectContentBlock[]
  context: CardProseContext
  /** On its own page the band's title already names the pattern: no stamp. */
  onPage?: boolean
  /**
   * A closing sentence the book prints under the pattern's prose — a legal
   * starting pattern's (`LEGAL_STARTING_PATTERN_NOTE`).
   */
  note?: string
}) {
  const body: SURefObjectContentBlock[] = note
    ? [...content, { type: 'paragraph', value: note }]
    : content
  if (onPage) return <CardProse body={body} context={context} />
  return (
    <div className="su-ec-block" style={STACK}>
      {/* `.su-ec-name-tab` (fit-content) scopes the title to ITSELF on a card: the solid Slab's leader
          rule is `flex-1`, so at full width it ran a line clear across the
          card and read as a card-wide divider rather than a label on the
          pattern block below it. Shrink-to-fit collapses the rule to its
          `min-w-3` stub, leaving a tight name tab. */}
      <Slab variant="solid" label={normalizePatternName(name)} className="su-ec-name-tab" />
      <CardProse body={body} context={context} />
    </div>
  )
}
