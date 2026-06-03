import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { getNpc } from 'salvageunion-reference'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { DisplayCard } from '../../shared/DisplayCard'
import { CardHeader } from '../../shared/CardHeader'
import { StatDisplay } from '../../shared/StatDisplay'
import { ValueDisplay } from '../../shared/ValueDisplay'
import type { StatItem } from '../../shared/statsBarTypes'
import { BlockContentRendererView } from '../BlockContentRendererView'
import { borderColorFromHeaderBg } from '../referenceEntityHelpers'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'
import { SectionSeparator } from './SectionSeparator'
import type {
  getReferenceEntityFontSizes,
  getReferenceEntitySpacing,
} from './referenceEntityDisplayTypes'

type ReferenceEntityNpcDisplayProps = {
  data: SURefMetaEntity
  compact: boolean
  fontSize: ReturnType<typeof getReferenceEntityFontSizes>
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  /** Optional children to render inside the NPC card body (e.g. editable fields) */
  npcChildren?: ReactNode
  /** Optional slot to replace the default HP display (e.g. editable HP control) */
  hpSlot?: ReactNode
  /** Whether to hide the NPC's own content blocks */
  hideContent?: boolean
  /** Whether the NPC is in a damaged state (parent damaged or HP=0) */
  damaged?: boolean
  /** When true, renders in content-block style instead of full card framing */
  embedded?: boolean
  /** Parent header background class (for content-block border color) */
  headerBg?: string
  /** Parent raw CSS color (for content-block border color) */
  headerBgColor?: string
  /** NPC name value (for inline editing in embedded mode) */
  npcName?: string
  /** Callback when NPC name changes */
  onNpcNameChange?: (name: string) => void
  /** Callback when NPC name input loses focus */
  onNpcNameBlur?: () => void
  /** Whether the NPC fields are read-only */
  readOnly?: boolean
  /** Show an "NPC" section separator above the NPC name/HP block */
  showSeparator?: boolean
  /** Hide the header row (name, position, HP) in embedded mode */
  hideHeader?: boolean
}

function NpcNameInput({
  value,
  onChange,
  onBlur,
  compact,
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  compact?: boolean
}) {
  const measureRef = useRef<HTMLSpanElement>(null)
  const [inputWidth, setInputWidth] = useState(0)
  const fontClass = compact ? 'text-base' : 'text-[1.75rem]'
  const placeholder = 'Name...'

  useEffect(() => {
    if (measureRef.current) {
      setInputWidth(measureRef.current.scrollWidth)
    }
  }, [value])

  return (
    <span className="relative inline-flex items-baseline">
      <span
        ref={measureRef}
        aria-hidden
        className={`pointer-events-none invisible absolute whitespace-pre font-cond ${fontClass} font-bold uppercase leading-none`}
      >
        {value || placeholder}
      </span>
      <Text
        variant="pseudoheader"
        as="span"
        className={cn(
          'inline-flex items-center box-decoration-clone bg-su-black px-1 text-su-white',
          fontClass,
          compact ? 'py-[3px]' : 'py-1'
        )}
        style={compact ? { lineHeight: 1 } : undefined}
      >
        <input
          type="text"
          size={1}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cn(
            'border-none bg-transparent p-0 outline-none',
            'font-cond font-bold uppercase leading-none tracking-tight',
            'text-su-white placeholder:normal-case placeholder:text-su-white/50',
            fontClass
          )}
          style={{ width: inputWidth || undefined, lineHeight: compact ? 1 : undefined }}
        />
      </Text>
    </span>
  )
}

export function ReferenceEntityNpcDisplay({
  data,
  compact,
  fontSize,
  spacing,
  npcChildren,
  hpSlot,
  hideContent = false,
  damaged = false,
  embedded = false,
  headerBg,
  headerBgColor,
  npcName,
  onNpcNameChange,
  onNpcNameBlur,
  readOnly = false,
  showSeparator,
  hideHeader = false,
}: ReferenceEntityNpcDisplayProps) {
  const npc = getNpc(data)
  if (!npc) return null

  const hasContent = !hideContent && npc.content && npc.content.length > 0
  // Static when explicitly readOnly OR when no interactive props are provided
  const isStatic = readOnly || (!npcChildren && !onNpcNameChange && !hpSlot)
  // showSeparator: explicit true/false overrides, undefined defaults to isStatic
  const renderSeparator = showSeparator ?? isStatic

  // Content-block style for NPCs rendered inside an ReferenceEntityDisplay (e.g. bays)
  if (embedded) {
    const borderColor = borderColorFromHeaderBg(headerBg, headerBgColor)
    const hasName = npcName !== undefined

    return (
      <div>
        {renderSeparator && <SectionSeparator label="NPC" compact={compact} />}
        {/* Header: editable name (large) + HP to the far right — hidden when hideHeader */}
        {!hideHeader && (
          <div className={cn('flex items-start justify-between gap-2', renderSeparator && 'mt-2')}>
            <div className="min-w-0">
              {hasName && (
                <div>
                  {readOnly || !onNpcNameChange ? (
                    <Text
                      variant="pseudoheader"
                      as="span"
                      className={cn(
                        'box-decoration-clone bg-su-black px-1 text-su-white uppercase tracking-[-0.02em]',
                        compact ? 'py-[3px] text-base' : 'py-1 text-[1.75rem]'
                      )}
                      style={compact ? { lineHeight: 1 } : undefined}
                    >
                      {npcName || '\u2014'}
                    </Text>
                  ) : (
                    <NpcNameInput
                      value={npcName}
                      onChange={onNpcNameChange}
                      onBlur={onNpcNameBlur}
                      compact={compact}
                    />
                  )}
                </div>
              )}
              {npc.position && (
                <ValueDisplay label="The" value={npc.position} compact={compact} inverse />
              )}
            </div>
            {npc.hitPoints > 0 && (
              <div className="shrink-0">
                {hpSlot ?? <StatDisplay label="HP" value={npc.hitPoints} compact={compact} />}
              </div>
            )}
          </div>
        )}

        {/* Content with left border (static/readOnly only) */}
        {isStatic && hasContent && (
          <div
            className={cn('mt-1', compact ? 'pl-2' : 'pl-3')}
            style={borderColor ? { borderLeft: `3px solid ${borderColor}` } : undefined}
          >
            <BlockContentRendererView
              content={npc.content!}
              fontSize={fontSize.sm}
              compact={compact}
            />
          </div>
        )}

        {/* Input fields flow below */}
        {npcChildren && <div className="mt-2">{npcChildren}</div>}
      </div>
    )
  }

  // Full card framing for standalone NPC display
  const hasName = npcName !== undefined

  // Build title: editable input or static name (falls back to position)
  const titleContent = hasName
    ? readOnly || !onNpcNameChange
      ? npcName || '\u2014'
      : ((
          <NpcNameInput
            value={npcName}
            onChange={onNpcNameChange}
            onBlur={onNpcNameBlur}
            compact={compact}
          />
        ) as React.ReactNode)
    : (npc.position ?? '')

  // HP as stats on DisplayCard (when no custom hpSlot), or as rightContent (when hpSlot)
  const npcStats: StatItem[] | undefined =
    npc.hitPoints > 0 && !hpSlot
      ? [{ key: 'npc-hp', label: 'HP', value: npc.hitPoints }]
      : undefined

  const headerContent = (
    <CardHeader
      title={titleContent}
      subtitle={
        hasName && npc.position ? (
          <ValueDisplay label="The" value={npc.position} compact inverse />
        ) : undefined
      }
      rightContent={npc.hitPoints > 0 && hpSlot ? hpSlot : undefined}
      compact={compact}
    />
  )

  return (
    <DisplayCard
      headerBg={damaged ? 'bg-su-grey' : 'bg-su-rust'}
      headerContent={headerContent}
      stats={npcStats}
      label="NPC"
      compact={compact}
    >
      {(hasContent || npcChildren) && (
        <div className="flex w-full flex-col gap-2" style={spacing.contentPaddingStyle}>
          {hasContent && (
            <BlockContentRendererView
              content={npc.content!}
              fontSize={fontSize.sm}
              compact={compact}
            />
          )}
          {npcChildren}
        </div>
      )}
    </DisplayCard>
  )
}
