import { getNpc } from 'salvageunion-reference'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { DisplayCard } from '../../shared/DisplayCard'
import { StatDisplay } from '../../shared/StatDisplay'
import { BlockContentRendererView } from '../BlockContentRendererView'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'
import type { getEntityFontSizes, getEntitySpacing } from './entityDisplayTypes'

type EntityNpcDisplayProps = {
  data: SURefMetaEntity
  compact: boolean
  fontSize: ReturnType<typeof getEntityFontSizes>
  spacing: ReturnType<typeof getEntitySpacing>
}

export function EntityNpcDisplay({ data, compact, fontSize, spacing }: EntityNpcDisplayProps) {
  const npc = getNpc(data)
  if (!npc) return null

  const hasContent = npc.content && npc.content.length > 0

  const headerContent = (
    <>
      <div className={cn('flex min-w-0 items-center', compact ? 'gap-0.5' : 'gap-1')}>
        <div
          className={cn(
            'flex min-w-0 flex-col justify-center overflow-visible',
            compact ? 'gap-0.5' : 'gap-1'
          )}
        >
          {npc.position && (
            <div className={cn(compact ? '' : 'overflow-hidden text-ellipsis whitespace-nowrap')}>
              <Text
                variant="pseudoheader"
                as="span"
                className={cn(
                  'relative z-10 uppercase tracking-[-0.02em] transition-transform duration-300',
                  compact ? 'py-[3px] text-base' : 'text-[1.75rem]'
                )}
                style={compact ? { lineHeight: 1 } : undefined}
              >
                {npc.position}
              </Text>
            </div>
          )}
        </div>
      </div>
      {npc.hitPoints > 0 && <StatDisplay label="HP" value={npc.hitPoints} compact={compact} />}
    </>
  )

  return (
    <DisplayCard
      headerBg="bg-su-rust"
      headerContent={headerContent}
      label="NPC"
      mode={compact ? 'compact' : 'full'}
      bodyPadding="p-0"
    >
      {hasContent && (
        <div
          className="w-full"
          style={{
            paddingLeft: `${spacing.contentPaddingX}rem`,
            paddingRight: `${spacing.contentPaddingX}rem`,
            paddingTop: `${spacing.contentPadding}rem`,
            paddingBottom: `${spacing.contentPadding}rem`,
          }}
        >
          <BlockContentRendererView
            content={npc.content!}
            fontSize={fontSize.sm}
            compact={compact}
            damaged={false}
          />
        </div>
      )}
    </DisplayCard>
  )
}
