import { memo, useState } from 'react'
import { CardHeader, DisplayCard, Text, ValueDisplay, deleteControl } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { getCustomItemHeaderBg } from '../../lib/customCargoCategories'
import { CustomItemDetailModal } from './CustomItemDetailModal'
import type { CargoRow } from '../../types/common'

type CustomStorageItemProps = {
  item: CargoRow
  onDelete?: () => void
}

/** Renders a custom cargo item as an entity-like listing with category-colored header */
export const CustomStorageItem = memo(function CustomStorageItem({
  item,
  onDelete,
}: CustomStorageItemProps) {
  const [showDetail, setShowDetail] = useState(false)
  const metadata = item.metadata as Record<string, unknown> | null
  const category = (metadata?.category as string) ?? undefined
  const techLevel = metadata?.tech_level as string | number | undefined
  const headerBg = getCustomItemHeaderBg(category, techLevel)

  const detailControl: ReferenceEntityControl = {
    key: 'detail',
    label: 'Details',
    onClick: () => setShowDetail(true),
    ariaLabel: 'View details',
  }

  const controls = [...(onDelete ? [deleteControl(onDelete)] : []), detailControl]

  // Build title with optional amount badge and CUSTOM ITEM tag
  const titleContent = (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <Text
          variant="pseudoheader"
          as="span"
          className="truncate py-[3px] text-base uppercase tracking-[-0.02em]"
          style={{ lineHeight: 1 }}
        >
          {item.name}
        </Text>
        {item.amount > 1 && (
          <span className="shrink-0 font-mono text-xs text-su-white/50">x{item.amount}</span>
        )}
      </div>
      <ValueDisplay
        label="Custom Item"
        compact
        bgColor="var(--color-su-rust)"
        textColor="var(--color-su-white)"
      />
    </div>
  )

  return (
    <>
      <DisplayCard
        compact
        listing
        headerBg={headerBg}
        headerContent={<CardHeader title={titleContent} controls={controls} compact lightweight />}
        onCardClick={detailControl.onClick}
      />
      <CustomItemDetailModal
        open={showDetail}
        onOpenChange={setShowDetail}
        item={item}
        headerBg={headerBg}
        category={category}
        techLevel={techLevel}
        metadata={metadata}
      />
    </>
  )
})
