/**
 * Body sections extracted from ReferenceEntityDisplayContent (audit item 21).
 *
 * Each component renders one cohesive slice of the card body and pulls
 * display state (spacing/fontSize) from the display-state context (item 20)
 * instead of prop drilling. Rendering rules are unchanged from the
 * pre-decomposition component — comments travel with the code they gate.
 */

import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'

import { cn } from '../../../../utils/cn'
import { CardImage } from '../../../shared/CardImage'
import { BlockContentRendererView } from '../../BlockContentRendererView'
import { GuideStepsDisplay } from '../../GuideStepsDisplay'
import type { GuideStepsInteractiveConfig } from '../../GuideStepsDisplay'
import { PatternEquipmentItem } from '../PatternEquipmentItem'
import { ReferenceEntityDisplay } from '../index'
import { ReferenceEntityChassisPatterns } from '../ReferenceEntityChassisPatterns'
import { ReferenceEntityNpcDisplay } from '../ReferenceEntityNpcDisplay'
import { ConditionalSheetInfo } from '../ConditionalSheetInfo'
import { SectionSeparator } from '../SectionSeparator'
import { useReferenceEntityDisplayContext } from '../displayStateContext'
import {
  getReferenceEntityFontSizes,
  getReferenceEntitySpacing,
} from '../referenceEntityDisplayTypes'
import type { NpcConfig } from '../referenceEntityDisplayTypes'
import { ReferenceEntityFactionData } from './ReferenceEntityFactionData'
import { GuideEntityListing } from './GuideEntityListing'
import type { SURefEnumSchemaName } from 'salvageunion-reference'

export type ContentBlocks = NonNullable<Parameters<typeof BlockContentRendererView>[0]['content']>

type EntityBodyTopMatterProps = {
  assetUrl: string | undefined
  imageAltText: string
  showContent: boolean
  contentBlocks: ContentBlocks | undefined
  children?: ReactNode
  chassisAbilitiesBlock: ReactNode
  hasChassisAbilities: boolean
  hideActions: boolean
  afterExtraContent?: ReactNode
  imageFloats: boolean
  headerBg: string
  headerBgColor?: string
  borderColor: string | undefined
  data: SURefEntity
  interactive?: GuideStepsInteractiveConfig
}

/**
 * The top of the body: entity image (grid or float), content prose, caller
 * children, chassis abilities, faction data, and guide steps.
 *
 * The image renders as a left-float (CardImage `md:float-left`) on every path
 * EXCEPT the two grid layouts (chassis abilities, afterExtraContent), which
 * place it in a grid cell. When it floats, only the body prose wraps around
 * it; the structured sections below are boxy and would be squeezed into the
 * narrow column beside the float, so the float is cleared after the prose.
 */
export function EntityBodyTopMatter({
  assetUrl,
  imageAltText,
  showContent,
  contentBlocks,
  children,
  chassisAbilitiesBlock,
  hasChassisAbilities,
  hideActions,
  afterExtraContent,
  imageFloats,
  headerBg,
  headerBgColor,
  borderColor,
  data,
  interactive,
}: EntityBodyTopMatterProps) {
  const ctx = useReferenceEntityDisplayContext()
  const compact = ctx?.compact ?? false
  const fontSize = ctx?.fontSize ?? getReferenceEntityFontSizes(compact)

  const prose = (
    <>
      {showContent && contentBlocks && (
        <BlockContentRendererView
          content={contentBlocks}
          fontSize={fontSize.sm}
          compact={compact}
          headerBg={headerBg}
          headerBgColor={headerBgColor}
        />
      )}
      {children}
    </>
  )

  if (assetUrl && hasChassisAbilities && !compact && !hideActions) {
    // Grid layout for chassis with images: ability anchored to bottom of image
    return (
      <div className="md:grid md:grid-cols-[auto_1fr]">
        <CardImage url={assetUrl} alt={imageAltText} compact={compact} />
        <div className="flex flex-col justify-evenly">
          <div>{prose}</div>
          {chassisAbilitiesBlock}
        </div>
      </div>
    )
  }

  return (
    <>
      {assetUrl && afterExtraContent && !compact ? (
        // Grid layout: vertically center content beside image when
        // afterExtraContent (e.g. class ability trees) will render below
        <div className="md:grid md:grid-cols-[auto_1fr] md:items-center">
          <CardImage url={assetUrl} alt={imageAltText} compact={compact} />
          <div>{prose}</div>
        </div>
      ) : (
        <>
          {assetUrl && <CardImage url={assetUrl} alt={imageAltText} compact={compact} />}
          {prose}
        </>
      )}
      {/* Only the body prose wraps the floated image; clear the float here so
          the structured sections below render full-width beneath the image
          instead of squeezed into the narrow column beside it. */}
      {imageFloats && <div className="clear-both" />}
      <ReferenceEntityFactionData data={data} compact={compact} borderColor={borderColor} />
      {/* Guide steps — data-shape driven */}
      {'steps' in data && Array.isArray(data.steps) && data.steps.length > 0 && (
        <GuideStepsDisplay
          steps={data.steps}
          compact={compact}
          headerBg={headerBg}
          headerBgColor={headerBgColor}
          interactive={interactive}
          renderEntityListing={(
            entityData,
            entitySchemaName,
            key,
            isListing,
            forceCompact,
            entityControls,
            entityDisabled
          ) => (
            <GuideEntityListing
              key={key}
              data={entityData as SURefEntity}
              schemaName={entitySchemaName as SURefEnumSchemaName}
              compact={forceCompact ?? isListing}
              listing={isListing}
              disabled={!!entityDisabled}
              controls={entityControls}
            />
          )}
        />
      )}
      {/* Non-compact: chassis abilities render before actions */}
      {!compact && !hideActions && chassisAbilitiesBlock}
    </>
  )
}

type EntityStatblockEquipmentProps = {
  systems: SURefEntity[] | undefined
  modules: SURefEntity[] | undefined
}

/**
 * Titan-equipped systems/modules render as compact listings under actions,
 * full-width below the (cleared) image float.
 */
export function EntityStatblockEquipment({ systems, modules }: EntityStatblockEquipmentProps) {
  const ctx = useReferenceEntityDisplayContext()
  const compact = ctx?.compact ?? false
  const spacing = ctx?.spacing ?? getReferenceEntitySpacing(compact)
  return (
    <>
      {systems && systems.length > 0 && (
        <>
          <SectionSeparator label="Mech Systems" compact={compact} />
          <div className={cn('flex flex-col', spacing.sectionSpaceYClass)}>
            {systems.map((system) => (
              <PatternEquipmentItem key={`statblock-system-${system.id}`} data={system} />
            ))}
          </div>
        </>
      )}
      {modules && modules.length > 0 && (
        <>
          <SectionSeparator label="Mech Modules" compact={compact} />
          <div className={cn('flex flex-col', spacing.sectionSpaceYClass)}>
            {modules.map((mod) => (
              <PatternEquipmentItem key={`statblock-module-${mod.id}`} data={mod} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

type EntityNpcSectionProps = {
  data: SURefEntity
  npcConfig?: NpcConfig
  damaged: boolean
  headerBg: string
  headerBgColor?: string
  rightContent?: ReactNode
  npcPosition: 'left' | 'right'
}

/**
 * The NPC block, optionally floated beside `rightContent` in a two-column
 * layout (crawler bay crew insets use this).
 */
export function EntityNpcSection({
  data,
  npcConfig,
  damaged,
  headerBg,
  headerBgColor,
  rightContent,
  npcPosition,
}: EntityNpcSectionProps) {
  const ctx = useReferenceEntityDisplayContext()
  const compact = ctx?.compact ?? false
  const npcBlock = (
    <>
      <ReferenceEntityNpcDisplay
        data={data}
        compact={compact}
        embedded
        npcChildren={npcConfig?.children}
        hpSlot={npcConfig?.hpSlot}
        damaged={npcConfig?.damaged ?? damaged}
        headerBg={headerBg}
        headerBgColor={headerBgColor}
        npcName={npcConfig?.name}
        readOnly={npcConfig?.readOnly}
        showSeparator={npcConfig?.showNpcSeparator}
        hideHeader={npcConfig?.hideNpcHeader}
      />
      {npcConfig?.afterContent}
    </>
  )
  return rightContent ? (
    <>
      <div
        className={
          npcPosition === 'right'
            ? 'md:float-right md:ml-4 md:w-1/2 md:border-l md:border-su-grey-light md:pl-4'
            : 'md:float-left md:mr-4 md:w-1/2 md:border-r md:border-su-grey-light md:pr-4'
        }
        style={{ shapeOutside: 'margin-box' }}
      >
        {npcBlock}
      </div>
      {rightContent}
      <div className="clear-both !mt-0" />
    </>
  ) : (
    npcBlock
  )
}

type EntityExtraSectionsProps = {
  data: SURefEntity
  droneEntity: SURefEntity | undefined
  hidePatterns: boolean
  hideDamagedEffect: boolean
  headerBg: string
  techLevel?: number | string
}

/**
 * Below-the-fold extras: the resolved drone card, chassis patterns, and the
 * Damaged Effect callout. (Grants render in the main body flow — granting
 * abilities stay visible in compact — not here.)
 */
export function EntityExtraSections({
  data,
  droneEntity,
  hidePatterns,
  hideDamagedEffect,
  headerBg,
}: EntityExtraSectionsProps) {
  const ctx = useReferenceEntityDisplayContext()
  const compact = ctx?.compact ?? false
  const fontSize = ctx?.fontSize ?? getReferenceEntityFontSizes(compact)
  return (
    <>
      {droneEntity && (
        <>
          <SectionSeparator label="Drone" compact={compact} />
          <ReferenceEntityDisplay
            data={droneEntity}
            compact
            hide={{ actions: true, patterns: true }}
          />
        </>
      )}
      {!hidePatterns && (
        <ReferenceEntityChassisPatterns
          patterns={'patterns' in data ? data.patterns : undefined}
          headerFontSize={fontSize.lg}
          chassisEntity={data}
        />
      )}
      {!hideDamagedEffect && 'damagedEffect' in data && data.damagedEffect && (
        <ConditionalSheetInfo
          propertyName="damagedEffect"
          labelBgColor="text-brand-srd"
          label="Damaged Effect"
          data={data}
          compact={compact}
          headerBg={headerBg}
        />
      )}
    </>
  )
}
