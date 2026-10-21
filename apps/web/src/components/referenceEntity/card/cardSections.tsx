/**
 * A full card's body and the sections under it, as nodes: the body box, the
 * roll table, the guide steps, the inline actions, the pattern section and the
 * nested groups. `ReferenceEntityCardInner` lays them out as a framed card or a
 * page; `resolveBodyProse` (`cardBodyProse.tsx`)
 * resolves what they print.
 */

import type { ReactNode } from 'react'
import { resolveTable } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { CardImage } from '../../compositions/CardImage'
import type { CardSize } from '../../containers/displayMode'
import { embeddedPeekAddress, tablePeekAddress } from '../../entity/peekContext'
import { BayInfo } from './BayInfo'
import { resolveBodyLayout } from './bodyBlocks'
import { CardProse, FoldedActionProse, PatternProse } from './CardProse'
import { CardRollTable } from './CardRollTable'
import type { BodyProse, CardBodyInput } from './cardBodyProse'
import { GuideSteps } from './GuideSteps'
import { LEGAL_STARTING_PATTERN_NOTE } from './legalStartingPattern'
import {
  CardStack,
  DroneCards,
  EmbeddedNpcMinis,
  InlineActions,
  NestedCardGroup,
} from './NestedCards'
import { PatternSection } from './PatternSection'
import { resolveGuideSteps } from './resolveGuideSteps'
import { WhenDamaged } from './WhenDamaged'

/** The body box's padding by size (board E1): tight on top under a "//" line. */
/**
 * A crawler type's two nested things say what they are as their first chip,
 * in place of a band over them (owner, round 5): its unique Crawler Ability
 * and its special NPC (Core Book p.212).
 */
export const CRAWLER_ABILITY_SEAL = { label: 'Crawler Ability', tone: 'var(--color-ink)' }
const CRAWLER_NPC_SEAL = { label: 'NPC', tone: 'var(--color-ink)' }

const BODY_PAD: Record<CardSize, { ruled: string; open: string }> = {
  full: { ruled: `${space[2]} ${space[14]} ${space[12]}`, open: `${space[12]} ${space[14]}` },
  compact: { ruled: `${space[2]} ${space[12]} ${space[12]}`, open: `${space[12]}` },
  mini: { ruled: `${space[2]} ${space[8]} ${space[8]}`, open: `${space[8]}` },
}

/**
 * The card body's class: with artwork a width container, so the art sits
 * beside the prose only when the CARD is wide and stacks above it when narrow
 * (`.su-ec-art-body`).
 */
function bodyClassName(hasArt: boolean): string | undefined {
  return hasArt ? 'su-ec-art-body' : undefined
}

/** The body and the sections under it, as nodes the card lays out. */
export function resolveCardSections(input: CardBodyInput, resolved: BodyProse) {
  const {
    entity,
    schemaName,
    pattern,
    entityName,
    resolvedChassisName,
    size,
    depth,
    compact,
    onPage,
    isAction,
    isDown,
    isLegalStartingPatternCard,
    hasSubLine,
    asideLeadRequested,
    tone,
    hide,
    foldedAction,
    assetUrl,
    assetSrcSet,
    sectionAs,
    afterExtraContent,
    selections,
    onSelectionChange,
    sectionFold,
    NestedCard,
  } = input
  const {
    canExpand,
    nestedGroups,
    patternGroups,
    patternActions,
    droneInfos,
    droneSystems,
    droneModules,
    showImage,
    damagedEffect,
    isSelfAction,
    foldedActionContent,
    prose,
    bodyNodes,
    leadBlocks,
    catalogLeadBlocks,
    inlineActionEntities,
    nestedHost,
  } = resolved
  const isPattern = !!pattern
  // A CRAWLER BAY reads as three sections (owner's call, 2026-10-20): its
  // Bay Info, then its crew NPC, then its When Damaged.
  const isBay = schemaName === 'crawler-bays'
  // ROLL TABLE — the entity's own, or its folded action's, under its ROLL THE
  // DIE bar (board E4). In a framed card it is a nested element, so it wears
  // its own box at the nested width (owner's call, 2026-10-14: "nested
  // elements should not be full-width"); flush on a page.
  const ownTable = resolveTable(entity)
  const entityTable = ownTable ?? resolveTable(foldedAction)
  const tableSource = ownTable ? entity : foldedAction
  const tableName =
    (tableSource && 'tableName' in tableSource && typeof tableSource.tableName === 'string'
      ? tableSource.tableName
      : undefined) ?? entityName
  const rollTableNode =
    entityTable && !hide?.rollTable ? (
      <CardRollTable
        table={entityTable}
        name={tableName}
        size={size}
        disabled={!!isDown}
        nested={!onPage}
        peekAt={onPage ? undefined : tablePeekAddress(tableSource)}
        tone={tone.bgColor}
      />
    ) : null

  // PATTERN PROSE — the pattern's own flavour, ahead of the loadout.
  // A legal starting pattern closes on the book's own sentence for it.
  const patternProse =
    isPattern && ((pattern.content && pattern.content.length > 0) || isLegalStartingPatternCard) ? (
      <PatternProse
        name={pattern.name}
        content={pattern.content ?? []}
        context={prose}
        named={onPage || size === 'mini'}
        note={isLegalStartingPatternCard ? LEGAL_STARTING_PATTERN_NOTE : undefined}
      />
    ) : null

  // GUIDE STEPS — the bulk of a guide's prose.
  const guideSteps = canExpand && !isAction ? resolveGuideSteps(entity) : []
  const guideStepsNode =
    guideSteps.length > 0 ? (
      <GuideSteps
        steps={guideSteps}
        prose={prose}
        sectionAs={sectionAs}
        depth={depth}
        isDown={isDown}
        compact={compact}
        tableTone={tone.bgColor}
        chassisName={resolvedChassisName}
        NestedCard={NestedCard}
        page={onPage}
      />
    ) : null

  // LEFT ANCHOR — the artwork; nested NPCs stack below it, not on the parent's paper.
  const { asideLead, flat } = resolveBodyLayout({
    showImage,
    isPattern,
    asideLeadRequested,
    hasTrailingSection: !!afterExtraContent,
  })
  const inFlowGroups = isPattern ? patternGroups : nestedGroups

  const anchorNode: ReactNode =
    showImage && assetUrl ? (
      <CardImage
        url={assetUrl}
        srcSet={assetSrcSet}
        alt={`${entityName} illustration`}
        compact={compact}
        aside={asideLead}
        hero={onPage}
      />
    ) : undefined

  const proseNodes: ReactNode[] = [
    ...(leadBlocks.length > 0 ? [<CardProse key="lead" body={leadBlocks} context={prose} />] : []),
    ...bodyNodes,
  ]

  // On a PAGE the art is the hero; an NPC anchor stays in flow. No art, no hero.
  const heroNode: ReactNode = onPage && showImage ? anchorNode : undefined
  const bodyAnchor: ReactNode = heroNode ? undefined : anchorNode

  const bodyHasContent =
    !!bodyAnchor ||
    proseNodes.length > 0 ||
    catalogLeadBlocks.length > 0 ||
    (!isSelfAction && !!foldedActionContent?.length && !hide?.content && !hide?.actions) ||
    (!onPage && !!guideStepsNode)

  // ACTIONS — inline, flush; below a Page, contentful Minis (N3, `InlineActions`).
  const actionsNode: ReactNode =
    inlineActionEntities.length > 0 ? (
      <InlineActions actions={inlineActionEntities} host={nestedHost} />
    ) : null

  const proseContent: ReactNode = (
    <>
      {/* In ASIDE LEAD the anchor and the prose are a centred row (a stack in
          a narrow card); otherwise the anchor floats and the prose flows
          around it. */}
      {asideLead && bodyAnchor ? (
        <div className="su-ec-lead">
          {bodyAnchor}
          {proseNodes.length > 0 && <div style={{ flex: 1, minWidth: 0 }}>{proseNodes}</div>}
        </div>
      ) : (
        <>
          {bodyAnchor}
          {proseNodes}
        </>
      )}
      {catalogLeadBlocks.length > 0 && <CardProse body={catalogLeadBlocks} context={prose} />}
      {/* A SELF-action's content already renders AS the body; only a
          differently-named folded action renders here (with its name). */}
      {!isSelfAction &&
        !hide?.content &&
        !hide?.actions &&
        foldedAction &&
        foldedActionContent &&
        foldedActionContent.length > 0 && (
          <FoldedActionProse
            action={foldedAction}
            entityName={entityName}
            content={foldedActionContent}
            context={prose}
          />
        )}
    </>
  )

  const bodyContent: ReactNode = (
    <>
      {/* The reference reads a bay's prose bare; only a sheet's folding bay names it Bay Info (owner, round 5). */}
      {isBay && sectionFold ? (
        <BayInfo subject={entityName} fold={sectionFold} onPage={onPage}>
          {proseContent}
        </BayInfo>
      ) : (
        proseContent
      )}
      {/* On a page the steps stand as a page section (`CardPage`'s `guide`). */}
      {!onPage && guideStepsNode}
    </>
  )

  const body = bodyHasContent ? (
    <div
      className={bodyClassName(!!bodyAnchor)}
      style={{
        ...(isDown ? { opacity: 0.6 } : {}),
        display: flat ? 'flow-root' : 'flex',
        flexDirection: 'column',
        gap: space[6],
        padding: hasSubLine ? BODY_PAD[size].ruled : BODY_PAD[size].open,
      }}
    >
      {bodyContent}
    </div>
  ) : null

  // PATTERN view → the pattern's own prose, then what it changes. On a card it
  // leads the actions (a card never carries the chassis ability); on a page
  // only its prose leads (`opening`), and the loadout follows the stats and the
  // chassis ability (`pageLoadout`).
  const patternSection = isPattern ? (
    <PatternSection
      prose={patternProse}
      groups={hide?.patterns || onPage ? [] : inFlowGroups}
      actions={hide?.actions ? [] : patternActions}
      padding={onPage ? '0' : BODY_PAD[size].open}
      sectionAs={sectionAs}
      host={nestedHost}
    />
  ) : null
  const pageLoadout = isPattern && !hide?.patterns ? inFlowGroups : []

  // NESTED ENTITIES — each group stacked in the frame, on a card or a page
  // alike; every child wears its own type stamp, so no group is labelled.
  // Nothing to nest is `null`, not an empty fragment: the card's lead gap
  // (`CardLead`) opens only for nested content, so a head-only card (a
  // creature's Stinger) closes on its head with no paper strip under it.
  // A crawler bay's crew NPC is a Peek Mini where it is level 2 (a bay's Card
  // on a sheet, N1). On the bay's Page it is one level deep, so it is drawn
  // open with all its content (N8, owner 2026-10-20: "the smith should be a
  // Listing row"), as it is where its crew choices are being made.
  const bayCrewPeek =
    schemaName === 'crawler-bays' && !onSelectionChange && !onPage && typeof entity.id === 'string'
      ? embeddedPeekAddress('crawler-bays', entity.id, 'npc')
      : undefined
  // WHEN DAMAGED — the bay's section above its crew (owner, round 7).
  const damagedNode: ReactNode =
    !hide?.damagedEffect && damagedEffect ? (
      onPage ? (
        <WhenDamaged effect={damagedEffect} subject={entityName} onPage fold={sectionFold} />
      ) : (
        <CardStack size={size}>
          <WhenDamaged effect={damagedEffect} subject={entityName} fold={sectionFold} />
        </CardStack>
      )
    ) : null
  const hasNestedGroups =
    !hide?.nested &&
    (!!damagedNode ||
      droneInfos.length > 0 ||
      droneSystems.length > 0 ||
      droneModules.length > 0 ||
      (!isPattern && inFlowGroups.some((group) => group.entities.length > 0)))
  const nestedGroupsNode = hasNestedGroups ? (
    <>
      <DroneCards drones={droneInfos} host={nestedHost} />
      {droneSystems.length > 0 && <NestedCardGroup entities={droneSystems} host={nestedHost} />}
      {droneModules.length > 0 && <NestedCardGroup entities={droneModules} host={nestedHost} />}
      {damagedNode}
      {!isPattern &&
        inFlowGroups.map((group) =>
          bayCrewPeek && group.kind === 'npc' ? (
            <EmbeddedNpcMinis
              key={group.label}
              entities={group.entities}
              host={nestedHost}
              peekAt={bayCrewPeek}
            />
          ) : (
            <NestedCardGroup
              key={group.label}
              entities={group.entities}
              host={nestedHost}
              seal={
                schemaName === 'crawlers' && group.kind === 'npc' ? CRAWLER_NPC_SEAL : undefined
              }
              write={group.kind === 'npc' ? { selections, onSelectionChange, hide } : undefined}
            />
          )
        )}
    </>
  ) : null
  return {
    rollTableNode,
    guideStepsNode,
    heroNode,
    bodyHasContent,
    bodyContent,
    body,
    actionsNode,
    patternSection,
    pageLoadout,
    nestedGroupsNode,
  }
}
