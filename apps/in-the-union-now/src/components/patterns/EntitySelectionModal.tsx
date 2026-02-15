import { useState, useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { DisplayCard } from 'suref-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Input } from '../ui/input'

type SchemaName = 'chassis' | 'systems' | 'modules'

type EntitySelectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  schemaName: SchemaName
  onSelect: (entityId: string) => void
  filter?: (entity: { id: string; name: string }) => boolean
}

type ListEntity = {
  id: string
  name: string
  techLevel?: number | 'B' | 'N'
  salvageValue?: number
  systemSlots?: number
  moduleSlots?: number
  slotsRequired?: number
}

function getEntities(schemaName: SchemaName): ListEntity[] {
  switch (schemaName) {
    case 'chassis':
      return SalvageUnionReference.Chassis.all().map((c) => ({
        id: c.id,
        name: c.name,
        techLevel: c.techLevel,
        salvageValue: c.salvageValue,
        systemSlots: c.systemSlots,
        moduleSlots: c.moduleSlots,
      }))
    case 'systems':
      return SalvageUnionReference.Systems.all().map((s) => ({
        id: s.id,
        name: s.name,
        techLevel: s.techLevel,
        salvageValue: s.salvageValue,
        slotsRequired: s.slotsRequired,
      }))
    case 'modules':
      return SalvageUnionReference.Modules.all().map((m) => ({
        id: m.id,
        name: m.name,
        techLevel: m.techLevel,
        salvageValue: m.salvageValue,
        slotsRequired: m.slotsRequired,
      }))
  }
}

function formatTechLevel(tl: number | 'B' | 'N'): string {
  if (tl === 'B') return 'Bio'
  if (tl === 'N') return 'NPC'
  return `TL${tl}`
}

function getEntityStats(entity: ListEntity, schemaName: SchemaName) {
  const parts: string[] = []

  if (entity.techLevel !== undefined) {
    parts.push(formatTechLevel(entity.techLevel))
  }

  if (schemaName === 'chassis' && entity.systemSlots !== undefined) {
    parts.push(`${entity.systemSlots}S/${entity.moduleSlots}M`)
  }

  if (
    (schemaName === 'systems' || schemaName === 'modules') &&
    entity.slotsRequired !== undefined
  ) {
    parts.push(`${entity.slotsRequired} slot${entity.slotsRequired !== 1 ? 's' : ''}`)
  }

  if (entity.salvageValue !== undefined) {
    parts.push(`${entity.salvageValue}SV`)
  }

  return parts.join(' \u00b7 ')
}

export function EntitySelectionModal({
  open,
  onOpenChange,
  title,
  schemaName,
  onSelect,
  filter,
}: EntitySelectionModalProps) {
  const [search, setSearch] = useState('')

  const entities = useMemo(() => {
    let all = getEntities(schemaName)
    if (filter) {
      all = all.filter(filter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      all = all.filter((e) => e.name.toLowerCase().includes(q))
    }
    return all
  }, [schemaName, search, filter])

  function handleSelect(entityId: string) {
    onSelect(entityId)
    onOpenChange(false)
    setSearch('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setSearch('')
      }}
    >
      <DialogContent className="max-h-[80vh] overflow-hidden bg-su-dark sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-su-orange">{title}</DialogTitle>
          <DialogDescription className="text-su-grey-dark">
            Select a {schemaName === 'chassis' ? 'chassis' : schemaName.slice(0, -1)} to add.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-su-grey-light/30 bg-su-dark-light text-su-white placeholder:text-su-grey-dark"
        />
        <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto pr-1">
          {entities.length === 0 ? (
            <p className="py-4 text-center text-sm text-su-grey-dark">No results found.</p>
          ) : (
            entities.map((entity) => (
              <DisplayCard
                key={entity.id}
                mode="listing"
                headerBg="bg-su-dark-light"
                headerContent={
                  <div className="flex w-full items-center justify-between gap-2 px-2">
                    <span className="truncate text-sm font-medium text-su-white">
                      {entity.name}
                    </span>
                    <span className="shrink-0 text-xs text-su-grey-dark">
                      {getEntityStats(entity, schemaName)}
                    </span>
                  </div>
                }
                onClick={() => handleSelect(entity.id)}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
