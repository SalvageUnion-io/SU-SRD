import { useMemo } from 'react'
import { SalvageUnionReference, getTechLevel, getDamage } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { EntityPickerModal } from '../shared/EntityPickerModal'

type WeaponSelectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (entityId: string) => void
  techLevel: number
  currentWeaponId?: string
}

export function WeaponSelectionDialog({
  open,
  onOpenChange,
  onSelect,
  techLevel,
  currentWeaponId,
}: WeaponSelectionDialogProps) {
  const weapons = useMemo((): SURefEntity[] => {
    return SalvageUnionReference.Systems.all().filter((s) => {
      const tl = getTechLevel(s)
      const dmg = getDamage(s)
      return tl !== undefined && typeof tl === 'number' && tl <= techLevel && dmg !== undefined
    })
  }, [techLevel])

  return (
    <EntityPickerModal
      open={open}
      onOpenChange={onOpenChange}
      title="Weapon System"
      subtitle={`Select a TL${techLevel} or lower weapon system.`}
      entities={weapons}
      onSelect={onSelect}
      currentEntityId={currentWeaponId}
    />
  )
}
