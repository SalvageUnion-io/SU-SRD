import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useRef } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { ArrowLeft, Swords, Cog, Wrench, Truck } from 'lucide-react'
import { usePilot, useUpdatePilot } from '../hooks/usePilot'
import { useMechsByPilot, useSetActiveMech, useUpdateMech } from '../hooks/useMech'
import { useCrawler } from '../hooks/useCrawler'
import { PilotHeader } from '../components/PilotSheet/PilotHeader'
import { MechStrip } from '../components/PilotSheet/MechStrip'
import { ActionsView } from '../components/PilotSheet/ActionsTab/ActionsView'
import { MechLoadout } from '../components/PilotSheet/MechTab/MechLoadout'
import { BuildView } from '../components/PilotSheet/BuildTab/BuildView'
import { CrawlerOverview } from '../components/PilotSheet/CrawlerTab/CrawlerOverview'
import { DiceRollFAB } from '../components/shared/DiceRollFAB'
import { DiceRollSheet } from '../components/shared/DiceRollSheet'
import { DEBOUNCE_TIMINGS } from 'suref-react'

export const Route = createFileRoute('/pilot/$id')({
  component: PilotSheetPage,
})

function PilotSheetPage() {
  const { id } = Route.useParams()
  const { data: pilot, isLoading: pilotLoading } = usePilot(id)
  const updatePilot = useUpdatePilot(id)
  const { data: mechs = [] } = useMechsByPilot(id)
  const setActiveMech = useSetActiveMech()

  const activeMech = mechs.find((m) => m.active) ?? mechs[0] ?? null
  const updateMech = useUpdateMech(activeMech?.id ?? '')

  const { data: crawler } = useCrawler(pilot?.crawler_id ?? '')

  // Debounced pilot update
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handlePilotUpdate = useCallback(
    (field: string, value: unknown) => {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        updatePilot.mutate({ [field]: value })
      }, DEBOUNCE_TIMINGS.autoSave)
    },
    [updatePilot]
  )

  // Debounced mech update
  const mechDebounce = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handleMechUpdate = useCallback(
    (field: string, value: unknown) => {
      clearTimeout(mechDebounce.current)
      mechDebounce.current = setTimeout(() => {
        updateMech.mutate({ [field]: value })
      }, DEBOUNCE_TIMINGS.autoSave)
    },
    [updateMech]
  )

  const handleSwitchMech = (mechId: string) => {
    setActiveMech.mutate({ pilotId: id, mechId })
  }

  const handleHeatChange = (newHeat: number) => {
    if (activeMech) {
      updateMech.mutate({ current_heat: newHeat })
    }
  }

  if (pilotLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pilot border-t-transparent" />
      </div>
    )
  }

  if (!pilot) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p className="text-su-grey">Pilot not found</p>
        <Link to="/" className="text-pilot underline">
          Back to roster
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      {/* Back nav */}
      <div className="flex items-center gap-2 px-4 py-2">
        <Link to="/" className="flex items-center gap-1 text-sm text-su-grey-dark hover:text-pilot">
          <ArrowLeft className="h-4 w-4" />
          Roster
        </Link>
      </div>

      {/* Pilot header */}
      <PilotHeader pilot={pilot} onUpdate={handlePilotUpdate} />

      {/* Active mech strip */}
      {activeMech && (
        <MechStrip
          mech={activeMech}
          allMechs={mechs}
          onUpdate={handleMechUpdate}
          onSwitchMech={handleSwitchMech}
        />
      )}

      {/* Tabbed content */}
      <Tabs.Root defaultValue="actions" className="flex flex-1 flex-col">
        <Tabs.List className="flex border-b border-[var(--border)] px-2">
          <Tabs.Trigger
            value="actions"
            className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-su-grey-dark transition-colors data-[state=active]:border-pilot data-[state=active]:text-pilot"
          >
            <Swords className="h-3.5 w-3.5" />
            Actions
          </Tabs.Trigger>
          <Tabs.Trigger
            value="mech"
            className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-su-grey-dark transition-colors data-[state=active]:border-mech data-[state=active]:text-mech"
          >
            <Cog className="h-3.5 w-3.5" />
            Mech
          </Tabs.Trigger>
          <Tabs.Trigger
            value="build"
            className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-su-grey-dark transition-colors data-[state=active]:border-pilot data-[state=active]:text-pilot"
          >
            <Wrench className="h-3.5 w-3.5" />
            Build
          </Tabs.Trigger>
          <Tabs.Trigger
            value="crawler"
            className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-su-grey-dark transition-colors data-[state=active]:border-crawler data-[state=active]:text-crawler"
          >
            <Truck className="h-3.5 w-3.5" />
            Crawler
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="actions" className="flex-1">
          <ActionsView pilotId={id} mechId={activeMech?.id} />
        </Tabs.Content>

        <Tabs.Content value="mech" className="flex-1">
          {activeMech ? (
            <MechLoadout mech={activeMech} />
          ) : (
            <div className="p-4 text-center text-sm text-su-grey">
              No mech assigned. Create one from the Mech tab.
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="build" className="flex-1">
          <BuildView pilot={pilot} onUpdate={handlePilotUpdate} />
        </Tabs.Content>

        <Tabs.Content value="crawler" className="flex-1">
          <CrawlerOverview crawler={crawler ?? null} crawlerId={pilot.crawler_id} />
        </Tabs.Content>
      </Tabs.Root>

      {/* Dice rolling */}
      <DiceRollFAB />
      <DiceRollSheet
        currentHeat={activeMech?.current_heat ?? 0}
        heatCapacity={activeMech?.heat_capacity ?? 0}
        onHeatChange={handleHeatChange}
      />
    </div>
  )
}
