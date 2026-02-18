import type { ReactNode } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { getDisplayName, getGoals, getAssets, getWeaknesses } from 'salvageunion-reference'
import { RollTable } from '../../../shared/RollTable'
import { CardHeader } from '../../../shared/CardHeader'
import { DisplayCard } from '../../../shared/DisplayCard'
import { ReferenceEntitySubTitleElement } from '../ReferenceEntitySubTitleContent'
import { ReferenceEntityLeftContent } from '../ReferenceEntityLeftContent'
import { ReferenceEntityRightHeaderContent } from '../ReferenceEntityRightHeaderContent'
import { ReferenceEntityChassisPatterns } from '../ReferenceEntityChassisPatterns'
import { ReferenceEntityFormation } from '../ReferenceEntityFormation'
import { ReferenceEntityNpcDisplay } from '../ReferenceEntityNpcDisplay'
import { ReferenceEntityChassisAbilitiesContent } from '../ReferenceEntityChassisAbilitiesContent'
import { ReferenceEntityRequirementDisplay } from '../ReferenceEntityRequirementDisplay'
import { ReferenceEntityChoices } from '../ReferenceEntityChoices'
import { ReferenceEntityGrants } from '../ReferenceEntityGrants'
import { ReferenceEntityBonusPerTechLevel } from '../ReferenceEntityBonusPerTechLevel'
import { ConditionalSheetInfo } from '../ConditionalSheetInfo'
import { ReferenceEntityActions } from '../ReferenceEntityActions'
import { ReferenceEntityImage } from '../ReferenceEntityImage'
import { BlockContentRendererView } from '../../BlockContentRendererView'
import { GuideStepsDisplay } from '../../GuideStepsDisplay'
import type { GuideStepsInteractiveConfig } from '../../GuideStepsDisplay'
import { cn } from '../../../../utils/cn'
import { Text } from '../../../base/Text'
import { borderColorFromHeaderBg, getSourceStyles } from '../../referenceEntityHelpers'
import { useReferenceEntityDisplayState } from '../useReferenceEntityDisplayState'
import type { ReferenceEntityDisplayStateInput } from '../useReferenceEntityDisplayState'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import type { NpcConfig } from '../referenceEntityDisplayTypes'
import { ReferenceEntityFooter } from './ReferenceEntityFooter'
import { ReferenceEntityFactionData } from './ReferenceEntityFactionData'
import { GuideEntityListing } from './GuideEntityListing'

export type ReferenceEntityDisplayContentProps = ReferenceEntityDisplayStateInput & {
  children?: ReactNode
  controls?: ReferenceEntityControl[]
  interactive?: GuideStepsInteractiveConfig
  npcConfig?: NpcConfig
  /** Content to render in a right column alongside the NPC section (creates a 2-column grid) */
  rightContent?: ReactNode
  /** Which side the NPC floats when rightContent is provided. Default 'left'. */
  npcPosition?: 'left' | 'right'
  /** When set, renders a semi-translucent overlay over the body with this text in a danger box */
  damageOverlayText?: string
  /** When true, header renders only title and controls — no subtitle, stats, or tech level */
  lightweight?: boolean
}

export function ReferenceEntityDisplayContent({
  children,
  controls,
  interactive,
  npcConfig,
  rightContent,
  npcPosition = 'left',
  damageOverlayText,
  lightweight = false,
  ...inputProps
}: ReferenceEntityDisplayContentProps) {
  const state = useReferenceEntityDisplayState(inputProps)
  const {
    data,
    schemaName,
    compact,
    title,
    headerBg,
    headerBgColor,
    spacing,
    opacity,
    shouldShowExtraContent,
    listing,
    hide,
    damaged,
    disabled,
    fontSize,
    assetUrl,
    chassisAbilities,
    effects,
    table,
    actionsToDisplay,
    matchingAction,
    source,
    label,
    techLevel,
    subtitleExtra,
    statsOverride,
    primaryStatsOnly: primaryStatsOnlyProp,
    abilitiesSection,
    afterExtraContent,
    footerOverride,
  } = state

  // Determine which content to render (from EntityTopMatter)
  let contentBlocks = hide.content ? undefined : 'content' in data ? data.content : undefined

  // Check if any action name matches the entity name - if so, use that action's content
  if (matchingAction && matchingAction.content && matchingAction.content.length > 0) {
    contentBlocks = matchingAction.content
  }

  // In compact list view (hide.actions), only show content before the first heading
  if (contentBlocks && compact && hide.actions) {
    const firstHeadingIndex = contentBlocks.findIndex((block) => block.type === 'heading')
    if (firstHeadingIndex > 0) {
      contentBlocks = contentBlocks.slice(0, firstHeadingIndex)
    }
  }

  // Show content if entity has content blocks
  const showContent = contentBlocks && contentBlocks.length > 0

  // Consolidate chassis abilities logic — data-shape driven
  const chassisName = 'name' in data ? data.name : undefined
  const hasChassisAbilities = !!chassisAbilities && chassisAbilities.length > 0

  // Check if entity has actions that will be displayed (after filtering)
  const hasDisplayableActions =
    !!actionsToDisplay &&
    actionsToDisplay.length > 0 &&
    (!hide.actions || compact) &&
    !(compact && schemaName === 'bio-titans')

  const hasTopMatterContent =
    !!showContent || hasChassisAbilities || !!assetUrl || hasDisplayableActions

  // Pre-built block for chassis abilities (reused at multiple render positions)
  // When abilitiesSection is provided by the caller, it replaces the entire built-in block
  const chassisAbilitiesBlock = abilitiesSection ? (
    abilitiesSection
  ) : hasChassisAbilities ? (
    <ReferenceEntityChassisAbilitiesContent
      chassisName={chassisName}
      spacing={spacing}
      compact={compact}
      chassisAbilities={chassisAbilities}
    />
  ) : null

  // Cache border color derivation (used in faction data and elsewhere)
  const borderColor = borderColorFromHeaderBg(headerBg, headerBgColor)

  // Determine if there is any body content to render (to avoid empty padding)
  const hasFactionContent = !!(getGoals(data) || getAssets(data) || getWeaknesses(data))
  const hasGuideSteps = 'steps' in data && Array.isArray(data.steps) && data.steps.length > 0
  const hasBodyContent =
    hasTopMatterContent ||
    !!children ||
    !!chassisAbilitiesBlock ||
    !!afterExtraContent ||
    hasFactionContent ||
    hasGuideSteps ||
    ('bonusPerTechLevel' in data && !!data.bonusPerTechLevel) ||
    (effects && effects.length > 0) ||
    !!table ||
    shouldShowExtraContent

  // Footer data
  const hasPage = 'page' in data && !!data.page
  const hasSource = 'source' in data && !!data.source
  const footerDisplayName = getDisplayName(schemaName)
  const sourceFooterStyles = getSourceStyles(source, disabled ?? false, 'footer', !listing)
  const hasFooter = !hide.footer && (hasPage || hasSource)

  const footer = footerOverride ? (
    footerOverride
  ) : hasFooter ? (
    <ReferenceEntityFooter
      footerDisplayName={footerDisplayName}
      source={hasSource ? data.source : undefined}
      page={hasPage ? data.page : undefined}
      compact={compact}
      headerBg={headerBg}
      headerBgColor={headerBgColor}
      contentPaddingX={spacing.contentPaddingX}
      sourceFooterStyles={sourceFooterStyles}
    />
  ) : null

  // Compose header content (previously assembled by Card internally)
  const titleNode = title ? (
    <div className={cn(compact ? '' : 'overflow-hidden text-ellipsis whitespace-nowrap')}>
      <Text
        variant="pseudoheader"
        as="span"
        className={cn(
          'relative z-10 uppercase tracking-[-0.02em] transition-transform duration-300',
          compact ? 'py-[3px] text-base' : 'text-[1.75rem]',
          disabled && 'opacity-50'
        )}
        style={compact ? { lineHeight: 1 } : undefined}
      >
        {title}
      </Text>
    </div>
  ) : null

  const headerContent = (
    <CardHeader
      title={titleNode ?? ''}
      subtitle={
        <ReferenceEntitySubTitleElement
          data={data}
          schemaName={schemaName}
          spacing={spacing}
          compact={compact}
          subtitleExtra={subtitleExtra}
        />
      }
      leftContent={
        <ReferenceEntityLeftContent
          techLevel={techLevel}
          compact={compact}
          listing={listing}
          level={'level' in data ? data.level : undefined}
        />
      }
      rightContent={
        !hide.stats ? (
          <ReferenceEntityRightHeaderContent
            data={data}
            compact={compact}
            fontSize={fontSize}
            techLevel={techLevel}
            listing={listing}
            primaryStatsOnly={primaryStatsOnlyProp ?? false}
            svOverride={statsOverride}
          />
        ) : null
      }
      controls={listing ? undefined : controls}
      compact={compact}
      lightweight={lightweight}
    />
  )

  const card = (
    <DisplayCard
      headerBg={headerBg}
      headerBgColor={headerBgColor}
      headerOpacity={opacity.header}
      headerContent={headerContent}
      footerContent={!hasBodyContent ? footer : undefined}
      label={label}
      mode={listing ? 'listing' : compact ? 'compact' : 'full'}
      headerTestId="frame-header-container"
      source={source}
      isExpanded={!listing}
      bodyPadding="p-0"
      disabled={disabled}
      controls={listing ? controls : undefined}
    >
      {!listing && hasBodyContent && (
        <div
          className={cn('min-w-0 bg-su-white p-0', damageOverlayText && 'relative')}
          style={{ opacity: opacity.content, width: '100%' }}
        >
          {/* Float zone: block flow so image float propagates to all children */}
          <div
            className={cn(spacing.sectionSpaceYClass)}
            style={{
              ...spacing.contentPaddingXStyle,
              paddingTop:
                source === 'We Were Here First!' || source === 'Rainmaker'
                  ? `calc(${spacing.contentPadding}rem + 10px)`
                  : source !== 'Salvage Union Workshop Manual' && hasTopMatterContent
                    ? `calc(${spacing.contentPadding * 0.25}rem + 5px)`
                    : `${spacing.contentPadding}rem`,
              paddingBottom:
                source === 'We Were Here First!' || source === 'Rainmaker'
                  ? `calc(${spacing.contentPadding}rem + 10px)`
                  : `${spacing.contentPadding}rem`,
            }}
          >
            {assetUrl && hasChassisAbilities && !compact && !hide.actions ? (
              // Grid layout for chassis with images: ability anchored to bottom of image
              <div className="md:grid md:grid-cols-[auto_1fr]">
                <ReferenceEntityImage title={title} compact={compact} assetUrl={assetUrl} />
                <div className="flex flex-col justify-evenly">
                  <div>
                    {showContent && (
                      <BlockContentRendererView
                        content={contentBlocks!}
                        fontSize={fontSize.sm}
                        compact={compact}
                        headerBg={headerBg}
                        headerBgColor={headerBgColor}
                      />
                    )}
                    {children}
                  </div>
                  {chassisAbilitiesBlock}
                </div>
              </div>
            ) : (
              <>
                {assetUrl && (
                  <ReferenceEntityImage title={title} compact={compact} assetUrl={assetUrl} />
                )}
                {showContent && (
                  <BlockContentRendererView
                    content={contentBlocks!}
                    fontSize={fontSize.sm}
                    compact={compact}
                    headerBg={headerBg}
                    headerBgColor={headerBgColor}
                  />
                )}
                {children}
                <ReferenceEntityFactionData
                  data={data}
                  compact={compact}
                  fontSize={fontSize}
                  borderColor={borderColor}
                />
                {/* Guide steps — data-shape driven */}
                {'steps' in data && Array.isArray(data.steps) && data.steps.length > 0 && (
                  <GuideStepsDisplay
                    steps={data.steps}
                    compact={compact}
                    headerBg={headerBg}
                    headerBgColor={headerBgColor}
                    fontSize={fontSize}
                    spacing={spacing}
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
                {!compact && !hide.actions && chassisAbilitiesBlock}
              </>
            )}
            {(!hide.actions || (compact && schemaName !== 'bio-titans' && !rightContent)) && (
              <ReferenceEntityActions
                suppressActions={hasChassisAbilities}
                spacing={spacing}
                compact={compact}
                actionsToDisplay={actionsToDisplay}
                headerBg={headerBg}
                sectionHeaders={schemaName === 'crawlers'}
              />
            )}
            {/* Compact: chassis abilities render after actions */}
            {compact && chassisAbilitiesBlock}

            <ReferenceEntityBonusPerTechLevel
              bonusPerTechLevel={'bonusPerTechLevel' in data ? data.bonusPerTechLevel : undefined}
              spacing={spacing}
              compact={compact}
              techLevel={techLevel}
            />
            {effects?.map((effect, index) => (
              <ConditionalSheetInfo
                key={index}
                propertyName="effects"
                label={effect.label}
                value={effect.value}
                data={data}
                compact={compact}
                fontSize={fontSize}
                headerBg={headerBg}
              />
            ))}

            <ReferenceEntityRequirementDisplay data={data} compact={compact} />
            {table && !hide.rollTable && (
              <div className="relative z-10 rounded-md">
                <RollTable
                  disabled={disabled}
                  table={table}
                  showCommand
                  compact
                  tableName={chassisName != null ? String(chassisName) : undefined}
                />
              </div>
            )}
            <ReferenceEntityFormation data={data} headerFontSize={fontSize.lg} compact={compact} />
            {(() => {
              const npcBlock = (
                <>
                  <ReferenceEntityNpcDisplay
                    data={data}
                    compact={compact}
                    embedded
                    fontSize={fontSize}
                    spacing={spacing}
                    npcChildren={npcConfig?.children}
                    hpSlot={npcConfig?.hpSlot}
                    damaged={npcConfig?.damaged ?? damaged}
                    headerBg={headerBg}
                    headerBgColor={headerBgColor}
                    npcName={npcConfig?.name}
                    onNpcNameChange={npcConfig?.onNameChange}
                    onNpcNameBlur={npcConfig?.onNameBlur}
                    readOnly={npcConfig?.readOnly}
                    showSeparator={npcConfig?.showNpcSeparator}
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
            })()}
            {shouldShowExtraContent && (
              <>
                {!hide.patterns && (
                  <ReferenceEntityChassisPatterns
                    patterns={'patterns' in data ? data.patterns : undefined}
                    headerFontSize={fontSize.lg}
                    chassisEntity={data}
                  />
                )}
                {!hide.damagedEffect && 'damagedEffect' in data && data.damagedEffect && (
                  <ConditionalSheetInfo
                    propertyName="damagedEffect"
                    labelBgColor="text-brand-srd"
                    label="Damaged Effect"
                    data={data}
                    compact={compact}
                    fontSize={fontSize}
                    headerBg={headerBg}
                  />
                )}
                {afterExtraContent}
                <ReferenceEntityGrants data={data} spacing={spacing} />
              </>
            )}
            <ReferenceEntityChoices
              data={data}
              spacing={spacing}
              fontSize={fontSize}
              hideChoices={hide.choices}
            />
            <div className="clear-both" />
          </div>
          {interactive?.renderFooter ? (
            <div
              className={cn('w-full py-3', headerBg || 'bg-su-white', sourceFooterStyles.className)}
              style={{
                ...spacing.contentPaddingXStyle,
                ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
                ...sourceFooterStyles.style,
              }}
            >
              {interactive.renderFooter()}
            </div>
          ) : (
            footer
          )}
          {damageOverlayText && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-b-md bg-black/50 p-4">
              <div className="rounded border-2 border-red-500/60 bg-red-800/90 px-4 py-3 text-center shadow-lg">
                <Text variant="pseudoheader" as="span" className="text-xs uppercase text-white">
                  Damaged
                </Text>
                <Text variant="default" className="mt-1 text-sm leading-snug text-red-100">
                  {damageOverlayText}
                </Text>
              </div>
            </div>
          )}
        </div>
      )}
    </DisplayCard>
  )

  return card
}
