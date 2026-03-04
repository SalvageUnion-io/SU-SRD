import { useMemo, useCallback } from 'react'
import { Text } from 'suref-react'
import { Check, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMechEntityRefs } from '../../../hooks/useMechs'
import { useSaveCustomiseAcknowledged } from '../../../hooks/useCrawlers'
import { isMechBayDamaged } from '../../../lib/bayDamageUtils'
import { getErrorMessage } from '../../../lib/errors'
import type { DowntimeRecordRow } from '../../../types/common'
import type { BayNpcData } from '../../../types/common'

type CustomiseStepProps = {
  mechId: string
  pilotId: string
  crawlerId: string
  activeDowntime: DowntimeRecordRow
  bayNpcs: Record<string, BayNpcData>
}

export function CustomiseStep({
  mechId,
  pilotId,
  crawlerId,
  activeDowntime,
  bayNpcs,
}: CustomiseStepProps) {
  const { data: mechRefs } = useMechEntityRefs(mechId)
  const saveAcknowledged = useSaveCustomiseAcknowledged()

  const bayDamaged = isMechBayDamaged(bayNpcs)

  const acknowledged = useMemo(() => {
    const acked = activeDowntime.customise_acknowledged as Record<string, boolean> | null
    return acked?.[pilotId] === true
  }, [activeDowntime.customise_acknowledged, pilotId])

  const systemCount = useMemo(
    () => mechRefs?.filter((r) => r.schema_name === 'systems').length ?? 0,
    [mechRefs]
  )
  const moduleCount = useMemo(
    () => mechRefs?.filter((r) => r.schema_name === 'modules').length ?? 0,
    [mechRefs]
  )

  const handleDone = useCallback(() => {
    saveAcknowledged.mutate(
      { recordId: activeDowntime.id, pilotId, crawlerId },
      {
        onSuccess: () => toast.success('Customisation complete'),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [activeDowntime.id, pilotId, crawlerId, saveAcknowledged])

  if (bayDamaged) {
    return (
      <div className="flex items-center gap-2 py-2">
        <AlertTriangle className="h-4 w-4 text-su-rust" />
        <Text variant="default" as="span" className="text-sm text-su-rust">
          Mech Bay is damaged — customisation unavailable.
        </Text>
      </div>
    )
  }

  if (acknowledged) {
    return (
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-su-green" />
        <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
          Customisation Complete
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Text variant="default" as="p" className="text-xs text-su-white/60">
        Current loadout: {systemCount} system{systemCount !== 1 ? 's' : ''}, {moduleCount} module
        {moduleCount !== 1 ? 's' : ''}. Use the Mech tab to swap systems and modules.
      </Text>

      <button
        type="button"
        onClick={handleDone}
        disabled={saveAcknowledged.isPending}
        className="flex w-full cursor-pointer items-center justify-center gap-2 bg-su-green px-4 py-2.5 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
      >
        {saveAcknowledged.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-su-white" />
        ) : null}
        <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
          {saveAcknowledged.isPending ? 'Saving...' : 'Done Customising'}
        </Text>
      </button>
    </div>
  )
}
