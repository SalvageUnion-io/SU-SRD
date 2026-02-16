import { useCallback, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { DisplayCard, ValueDisplay, SectionSeparator, Text, navigateControl } from 'suref-react'
import type { EntityControl } from 'suref-react'
import { useAuthStore } from '../../stores/authStore'
import { usePilots, usePilotAbilityCounts } from '../../hooks/usePilots'
import { useMech } from '../../hooks/useMechs'
import { Skeleton } from '../ui/skeleton'
import { EMPTY_SLOT_CLASSES } from '../patterns/emptySlotClasses'
import type { PilotRow } from '../../types/common'

const CONTROL_VARIANT_STYLES: Record<string, string> = {
  primary: 'bg-su-green text-su-white hover:bg-emerald-600',
  danger: 'text-su-white/60 hover:bg-su-rust/80 hover:text-su-white',
  ghost: 'opacity-60 hover:bg-white/20 hover:opacity-100',
}

function ControlButtons({ controls }: { controls: EntityControl[] }) {
  return (
    <div className="flex gap-2">
      {controls.map((control) => {
        const Icon = control.icon
        return (
          <button
            key={control.key}
            type="button"
            className={`flex min-w-[25px] shrink-0 cursor-pointer items-center justify-center self-center rounded p-1 transition-colors ${CONTROL_VARIANT_STYLES[control.variant ?? 'ghost'] ?? ''}`}
            title={control.ariaLabel}
            aria-label={control.ariaLabel}
            onClick={(e) => {
              e.stopPropagation()
              control.onClick()
            }}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}

export function PilotSection() {
  const user = useAuthStore((s) => s.user)
  const { data: pilots, isLoading } = usePilots(user?.id)

  const pilotIds = useMemo(() => pilots?.map((p) => p.id) ?? [], [pilots])
  const { data: abilityCounts } = usePilotAbilityCounts(pilotIds)

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Pilots" fontSize="text-sm" />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[40px] rounded-md" />
          <Skeleton className="h-[40px] rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pilots?.map((pilot) => (
            <PilotListing
              key={pilot.id}
              pilot={pilot}
              abilityCount={abilityCounts?.[pilot.id] ?? 0}
            />
          ))}
          <NewPilotSlot />
        </div>
      )}
    </div>
  )
}

function PilotListing({ pilot, abilityCount }: { pilot: PilotRow; abilityCount: number }) {
  const navigate = useNavigate()
  const { data: mech } = useMech(pilot.mech_id ?? undefined)

  const pilotClassName = useMemo(() => {
    const cls = SalvageUnionReference.get('classes', pilot.class_ref)
    return cls?.name ?? 'Unknown'
  }, [pilot.class_ref])

  const mechLabel = useMemo(() => {
    if (!mech) return undefined
    const chassis = SalvageUnionReference.Chassis.find((c) => c.id === mech.chassis_ref)
    if (!chassis) return undefined
    return `${chassis.name} \u201C${mech.pattern_name ?? 'Unnamed'}\u201D`
  }, [mech])

  const handleNavigate = useCallback(() => {
    navigate({ to: '/pilots/$pilotId', params: { pilotId: pilot.id } })
  }, [navigate, pilot.id])

  const controls = useMemo(() => [navigateControl(handleNavigate)], [handleNavigate])

  const headerContent = (
    <>
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <Text
          variant="pseudoheader"
          as="span"
          className="py-[3px] text-base uppercase tracking-[-0.02em]"
          style={{ lineHeight: 1 }}
        >
          {pilot.callsign}
        </Text>
        <div className="flex flex-wrap items-center gap-1">
          <ValueDisplay label="Class" value={pilotClassName} compact />
          <ValueDisplay label="Abilities" value={abilityCount} compact />
          {mechLabel && (
            <span
              className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black px-1 font-mono text-xs font-normal uppercase leading-none text-su-white"
              style={{ backgroundColor: 'rgb(122, 151, 138)' }}
            >
              {mechLabel}
            </span>
          )}
        </div>
      </div>
      <ControlButtons controls={controls} />
    </>
  )

  return <DisplayCard headerBg="bg-su-orange" headerContent={headerContent} mode="listing" />
}

function NewPilotSlot() {
  return (
    <Link to="/pilots/new" className="block">
      <div className={EMPTY_SLOT_CLASSES}>
        <Plus className="h-4 w-4" />
        <span className="font-mono text-sm font-semibold uppercase">New Pilot</span>
      </div>
    </Link>
  )
}
