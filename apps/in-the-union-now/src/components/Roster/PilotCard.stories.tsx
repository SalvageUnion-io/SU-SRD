import type { Story } from '@ladle/react'
import type { Pilot, Mech, PilotWithActiveMech } from '../../types/common'

export default { title: 'Roster/PilotCard' }

// NOTE: PilotCard uses <Link> from @tanstack/react-router which requires
// a router context. We render the card's visual content directly here
// to avoid the router dependency. If a full router provider is added to
// .ladle/components.tsx in the future, switch to importing PilotCard directly.

const basePilot: Pilot = {
  id: 'mock-pilot-1',
  user_id: 'mock-user',
  callsign: 'Rust',
  class_ref: 'engineer',
  advanced_class_ref: null,
  max_hp: 10,
  current_hp: 8,
  max_ap: 5,
  current_ap: 3,
  current_tp: 1,
  appearance: 'Grizzled veteran with cybernetic arm',
  background: 'Former factory worker',
  keepsake: 'Rusty wrench from first job',
  motto: 'If it moves, I can fix it',
  background_used: false,
  keepsake_used: false,
  motto_used: false,
  notes: '',
  image_url: null,
  crawler_id: null,
  active: true,
  private: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const baseMech: Mech = {
  id: 'mock-mech-1',
  user_id: 'mock-user',
  pilot_id: 'mock-pilot-1',
  name: 'The Crusher',
  chassis_ref: 'mule',
  pattern_name: 'Standard Mule',
  current_sp: 5,
  max_sp: 8,
  current_ep: 4,
  max_ep: 6,
  current_heat: 2,
  heat_capacity: 4,
  appearance: 'Battle-scarred with custom paint',
  quirk: 'Squeaky left leg servo',
  notes: '',
  image_url: null,
  active: true,
  private: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// Inline rendering of the PilotCard layout to avoid TanStack Router dependency.
// This mirrors the PilotCard component structure exactly.
import { User, Cog } from 'lucide-react'
import { cn, ResourceBar } from 'suref-react'

function PilotCardPreview({ pilot }: { pilot: PilotWithActiveMech }) {
  const mech = pilot.active_mech

  return (
    <div className="group block rounded-xl border-2 border-pilot/30 bg-[var(--card)] p-4 transition-all hover:border-pilot hover:shadow-md cursor-pointer">
      {/* Pilot header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pilot/20 text-pilot">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold leading-tight">{pilot.callsign || 'Unnamed Pilot'}</h3>
            {pilot.class_ref && (
              <p className="text-xs capitalize text-su-grey-dark">{pilot.class_ref}</p>
            )}
          </div>
        </div>
      </div>

      {/* Pilot resources */}
      <div className="mb-3 space-y-1">
        <ResourceBar
          label="HP"
          current={pilot.current_hp}
          max={pilot.max_hp}
          colorClass="bg-pilot"
          compact
        />
        <div className="flex gap-4 text-xs">
          <span>
            AP:{' '}
            <span className="font-bold">
              {pilot.current_ap}/{pilot.max_ap}
            </span>
          </span>
          <span>
            TP: <span className="font-bold">{pilot.current_tp}</span>
          </span>
        </div>
      </div>

      {/* Active mech strip */}
      {mech && (
        <div className="rounded-lg border border-mech/30 bg-mech/5 p-2">
          <div className="mb-1 flex items-center gap-2">
            <Cog className="h-3.5 w-3.5 text-mech" />
            <span className="text-xs font-medium">
              {mech.name || 'Unnamed Mech'}
              {mech.chassis_ref && (
                <span className="ml-1 text-su-grey-dark">({mech.chassis_ref})</span>
              )}
            </span>
          </div>
          <div className="space-y-0.5">
            <ResourceBar
              label="SP"
              current={mech.current_sp}
              max={mech.max_sp}
              colorClass="bg-mech"
              compact
            />
            <div className="flex gap-3 text-xs">
              <span>
                EP:{' '}
                <span className="font-bold">
                  {mech.current_ep}/{mech.max_ep}
                </span>
              </span>
              <span
                className={cn(
                  mech.heat_capacity > 0 && mech.current_heat / mech.heat_capacity > 0.75
                    ? 'text-heat-critical'
                    : ''
                )}
              >
                HT:{' '}
                <span className="font-bold">
                  {mech.current_heat}/{mech.heat_capacity}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {!mech && <p className="text-xs italic text-su-grey">No active mech</p>}
    </div>
  )
}

export const Default: Story = () => (
  <div className="max-w-sm">
    <PilotCardPreview pilot={{ ...basePilot, active_mech: baseMech }} />
  </div>
)

export const NoActiveMech: Story = () => (
  <div className="max-w-sm">
    <PilotCardPreview pilot={{ ...basePilot, active_mech: null }} />
  </div>
)
NoActiveMech.meta = {
  description: 'A pilot with no active mech shows "No active mech" text instead of the mech strip.',
}

export const LowResources: Story = () => (
  <div className="max-w-sm">
    <PilotCardPreview
      pilot={{
        ...basePilot,
        current_hp: 2,
        current_ap: 0,
        current_tp: 0,
        active_mech: {
          ...baseMech,
          current_sp: 1,
          current_ep: 0,
          current_heat: 3,
        },
      }}
    />
  </div>
)
LowResources.meta = {
  description: 'A pilot and mech both in critical condition with depleted resources.',
}

export const HighHeatMech: Story = () => (
  <div className="max-w-sm">
    <PilotCardPreview
      pilot={{
        ...basePilot,
        active_mech: {
          ...baseMech,
          current_heat: 4,
          heat_capacity: 4,
        },
      }}
    />
  </div>
)
HighHeatMech.meta = {
  description: 'The heat value turns critical color when above 75% capacity.',
}

export const NoClass: Story = () => (
  <div className="max-w-sm">
    <PilotCardPreview
      pilot={{
        ...basePilot,
        class_ref: null,
        callsign: 'New Recruit',
        active_mech: null,
      }}
    />
  </div>
)

export const UnnamedPilot: Story = () => (
  <div className="max-w-sm">
    <PilotCardPreview
      pilot={{
        ...basePilot,
        callsign: '',
        active_mech: baseMech,
      }}
    />
  </div>
)
UnnamedPilot.meta = {
  description: 'A pilot with no callsign displays "Unnamed Pilot".',
}

export const RosterGrid: Story = () => (
  <div className="grid max-w-2xl grid-cols-2 gap-4">
    <PilotCardPreview pilot={{ ...basePilot, active_mech: baseMech }} />
    <PilotCardPreview
      pilot={{
        ...basePilot,
        id: 'mock-pilot-2',
        callsign: 'Sparks',
        class_ref: 'scout',
        current_hp: 6,
        current_ap: 4,
        active_mech: {
          ...baseMech,
          id: 'mock-mech-2',
          name: 'Stinger',
          chassis_ref: 'hornet',
          current_sp: 3,
          max_sp: 5,
          current_heat: 1,
          heat_capacity: 3,
        },
      }}
    />
    <PilotCardPreview
      pilot={{
        ...basePilot,
        id: 'mock-pilot-3',
        callsign: 'Boulder',
        class_ref: 'hauler',
        current_hp: 10,
        max_hp: 12,
        current_ap: 2,
        active_mech: null,
      }}
    />
    <PilotCardPreview
      pilot={{
        ...basePilot,
        id: 'mock-pilot-4',
        callsign: '',
        class_ref: null,
        current_hp: 5,
        current_ap: 5,
        active_mech: null,
      }}
    />
  </div>
)
RosterGrid.meta = {
  description:
    'Multiple pilot cards in a 2-column grid layout as they would appear in the roster view.',
}
