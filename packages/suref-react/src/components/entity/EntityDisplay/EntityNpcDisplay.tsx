import { getNpc } from 'salvageunion-reference'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { Card } from '../../shared/Card'
import { StatDisplay } from '../../shared/StatDisplay'
import { BlockContentRendererView } from '../BlockContentRendererView'
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

  return (
    <Card
      bg="bg-su-white"
      headerBg="bg-su-rust"
      title={npc.position}
      label="NPC"
      compact={compact}
      rightContent={
        npc.hitPoints > 0 ? (
          <StatDisplay label="HP" value={npc.hitPoints} compact={compact} />
        ) : undefined
      }
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
    </Card>
  )
}
