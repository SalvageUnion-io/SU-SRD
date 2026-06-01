import { ModalShell, StatControl, Text } from 'suref-react'
import type { PilotEditConfig } from '../../../hooks/usePilotSheet'
import type { PilotRow, MechRow } from '../../../types/common'

type PilotSheetSettingsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pilot: PilotRow
  mech: MechRow | null | undefined
  compact: boolean
  canEdit: boolean
  editConfig: PilotEditConfig
}

export function PilotSheetSettingsModal({
  open,
  onOpenChange,
  pilot,
  mech,
  compact,
  canEdit,
  editConfig,
}: PilotSheetSettingsModalProps) {
  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Settings"
      headerBg="bg-su-grey-dark"
      maxWidth="max-w-md"
    >
      <div className={compact ? 'space-y-4 p-3' : 'space-y-5 p-4'}>
        <div>
          <Text variant="pseudoheader" as="span" className="mb-2 block text-sm uppercase">
            Pilot Stats
          </Text>
          <div className="flex flex-wrap items-start gap-3">
            <StatControl
              label="HP"
              value={pilot.hp}
              max={pilot.max_hp}
              canEdit={canEdit}
              compact={compact}
              onChange={(v) => editConfig.onStatChange('hp', v)}
            />
            <StatControl
              label="Max HP"
              value={pilot.max_hp}
              canEdit={canEdit}
              compact={compact}
              onChange={(v) =>
                editConfig.onPilotUpdate({ max_hp: v }, `${pilot.callsign} Max HP → ${v}`)
              }
            />
            <StatControl
              label="AP"
              value={pilot.ap}
              max={pilot.max_ap}
              canEdit={canEdit}
              compact={compact}
              onChange={(v) => editConfig.onStatChange('ap', v)}
            />
            <StatControl
              label="TP"
              value={pilot.tp}
              canEdit={canEdit}
              compact={compact}
              onChange={(v) => editConfig.onStatChange('tp', v)}
            />
          </div>
        </div>

        {mech && (
          <div>
            <Text variant="pseudoheader" as="span" className="mb-2 block text-sm uppercase">
              Mech Stats
            </Text>
            <div className="flex flex-wrap items-start gap-3">
              <StatControl
                label="SP"
                value={mech.current_sp}
                max={mech.max_sp}
                canEdit={canEdit}
                compact={compact}
                onChange={(v) => editConfig.onUpdateMech({ current_sp: v })}
              />
              <StatControl
                label="EP"
                value={mech.current_ep}
                max={mech.max_ep}
                canEdit={canEdit}
                compact={compact}
                onChange={(v) => editConfig.onUpdateMech({ current_ep: v })}
              />
            </div>
          </div>
        )}

        {!pilot.crawler_id && (
          <div>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-su-black bg-su-pink px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-su-pink/80"
              onClick={editConfig.onToggleDowntime}
            >
              {pilot.in_downtime ? 'Exit Downtime' : 'Trigger Downtime'}
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  )
}
