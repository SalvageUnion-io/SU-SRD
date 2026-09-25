/**
 * The card's prose bands — every place `ReferenceEntityCard` hands content
 * blocks to `Content`, sharing ONE set of card-derived props so the five call
 * sites cannot drift (audit PK-08 split them out of the card body).
 */

import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { Slab } from '../../chrome/Slab'
import { Content } from '../Content'
import { stripHostParenthetical } from './stripHostParenthetical'

/** The card context every prose band renders with. */
export type CardProseContext = {
  /** Whether the card's record carries structured data for its prose (ADR-029). */
  rulesBearing: boolean
  compact: boolean
  /** Resolves `[(CHASSIS)]` tokens. */
  chassisName: string | undefined
  headerBg: string | undefined
  headerBgColor: string | undefined
}

/** A run of content blocks, rendered in the card's own prose styling. */
export function CardProse({
  body,
  context,
}: {
  body: SURefObjectContentBlock[]
  context: CardProseContext
}) {
  return (
    <Content
      rulesBearing={context.rulesBearing}
      body={body}
      compact={context.compact}
      chassisName={context.chassisName}
      fontSize={context.compact ? 'text-xs' : 'text-sm'}
      headerBg={context.headerBg}
      headerBgColor={context.headerBgColor}
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
    <div className="flex flex-col gap-1.5 [&:not(:last-child)]:mb-3">
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
 * body. It renders between the chassis ability and the loadout groups, which
 * is what makes a pattern view read chassis → chassis ability → pattern →
 * systems → modules. (A `head` pattern row surfaces this same text as its
 * header hint and returns before the body, so it never doubles up.)
 */
export function PatternProse({
  name,
  content,
  context,
}: {
  name: string
  content: SURefObjectContentBlock[]
  context: CardProseContext
}) {
  return (
    <div className="flex flex-col gap-1.5 [&:not(:last-child)]:mb-3">
      {/* `w-fit` scopes the title to ITSELF: the solid Slab's leader rule is
          `flex-1`, so at full width it ran a line clear across the card and
          read as a page-wide divider rather than a label on the pattern
          block below it. Shrink-to-fit collapses the rule to its `min-w-3`
          stub, leaving a tight name tab. */}
      <Slab variant="solid" label={normalizePatternName(name)} className="w-fit" />
      <CardProse body={content} context={context} />
    </div>
  )
}
