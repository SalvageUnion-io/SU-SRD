import type { ReactNode } from 'react'
import { SalvageUnionReference, isKeyword } from 'salvageunion-reference'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import * as HoverCard from '@radix-ui/react-hover-card'
import { EntityDisplay } from './EntityDisplay'
import { Tooltip } from '../ui/tooltip'

type EntityDisplayTooltipProps = {
  schemaName: SURefEnumSchemaName
  entityId: string
  children: ReactNode
  /** Whether to show an arrow pointing to the trigger (default: false) */
  showArrow?: boolean
  /** Delay before showing tooltip in ms (default: 200) */
  openDelay?: number
  /** Delay before hiding tooltip in ms (default: 100) */
  closeDelay?: number
  /** Whether the wrapper should take full width (default: false) */
  fullWidth?: boolean
}

function getKeywordDescription(entity: unknown): string | null {
  if (
    typeof entity === 'object' &&
    entity !== null &&
    'content' in entity &&
    Array.isArray((entity as { content: unknown }).content)
  ) {
    const content = (entity as { content: { type: string; value: string }[] }).content
    const paragraphs = content.filter((block) => block.type === 'paragraph')
    return paragraphs.map((block) => block.value).join(' ') || null
  }
  return null
}

/**
 * EntityDisplayTooltip - Shows EntityDisplay content in a hover card
 * Wraps children and displays entity details on hover
 * Keywords render as a simple text tooltip; other entities render as a full card.
 *
 * @example
 * <EntityDisplayTooltip schemaName="systems" entityId="laser-cannon-id">
 *   <Text>Hover me to see details</Text>
 * </EntityDisplayTooltip>
 */
export function EntityDisplayTooltip({
  schemaName,
  entityId,
  children,
  showArrow = false,
  openDelay = 200,
  closeDelay = 100,
  fullWidth = false,
}: EntityDisplayTooltipProps) {
  const entity = SalvageUnionReference.get(schemaName, entityId)

  if (!entity) {
    return <>{children}</>
  }

  if (isKeyword(entity)) {
    const description = getKeywordDescription(entity)
    if (description) {
      return (
        <Tooltip content={description} delayDuration={openDelay}>
          <span
            style={{
              margin: 0,
              lineHeight: 1,
              cursor: 'help',
              display: fullWidth ? 'block' : 'inline-flex',
              flexShrink: 0,
              flexGrow: 0,
              width: fullWidth ? '100%' : 'auto',
            }}
          >
            {children}
          </span>
        </Tooltip>
      )
    }
  }

  return (
    <HoverCard.Root openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCard.Trigger asChild>
        <span
          role="button"
          tabIndex={0}
          style={{
            margin: 0,
            lineHeight: 1,
            cursor: 'help',
            display: fullWidth ? 'block' : 'inline-flex',
            flexShrink: 0,
            flexGrow: 0,
            width: fullWidth ? '100%' : 'auto',
          }}
        >
          {children}
        </span>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="z-50 max-h-[80vh] max-w-[500px] overflow-y-auto border-none bg-transparent p-0 shadow-2xl"
          sideOffset={5}
          align="start"
        >
          {showArrow && <HoverCard.Arrow />}
          <EntityDisplay data={entity} compact />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
