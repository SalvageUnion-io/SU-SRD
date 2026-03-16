import { useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySchemaName } from 'salvageunion-reference'
import { toast } from 'sonner'
import { showSaveToast } from '../lib/toastUtils'
import { getErrorMessage } from '../lib/errors'
import { changeLogApi } from '../lib/api/changeLogApi'
import type { CrawlerUpdate, EntityRefUpdate, MechUpdate } from '../types/common'
import type { PilotSheetMutationDeps } from './usePilotSheetMutations'

/**
 * Mech mutation handlers: mech stat updates, mech entity ref updates,
 * and crawler updates.
 */
export function usePilotSheetMechMutations(deps: PilotSheetMutationDeps) {
  const { user, mech, mechRefs, crawler, chassisName, mutations } = deps
  const { updateMech, updateMechEntityRef, updateCrawlerMutation } = mutations

  const handleUpdateMech = useCallback(
    (input: Partial<MechUpdate>) => {
      if (!mech || !user) return
      const mechLabel = mech.pattern_name || chassisName || 'Mech'
      updateMech.mutate(
        { mechId: mech.id, input },
        {
          onSuccess: () => {
            const fields = Object.keys(input)
            const fieldLabel =
              fields.length === 1 && fields[0]
                ? fields[0].replace('current_', '').toUpperCase()
                : 'stats'
            showSaveToast(`${mechLabel} ${fieldLabel} updated`)
            for (const [field, newValue] of Object.entries(input)) {
              const oldValue = mech[field as keyof typeof mech]
              changeLogApi
                .log(user.id, {
                  targetId: mech.id,
                  targetType: 'mech',
                  action: 'update',
                  field,
                  oldValue: oldValue as unknown,
                  newValue,
                  description: `Mech ${field} ${oldValue} → ${newValue}`,
                })
                .catch(() => {})
            }
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mech, user, chassisName, updateMech]
  )

  const handleUpdateMechEntityRef = useCallback(
    (refId: string, input: EntityRefUpdate) => {
      if (!mech || !user) return
      const ref = mechRefs.find((r) => r.id === refId)
      const mechLabel = mech.pattern_name || chassisName || 'Mech'
      const refName = ref
        ? SalvageUnionReference.get(ref.schema_name as EntitySchemaName, ref.schema_ref_id)?.name
        : undefined
      updateMechEntityRef.mutate(
        { refId, input, mechId: mech.id },
        {
          onSuccess: () => {
            if (input.condition) {
              showSaveToast(`${refName ?? 'Equipment'} → ${input.condition}`)
            } else {
              showSaveToast(`${mechLabel} loadout updated`)
            }
            if (input.condition && ref) {
              changeLogApi
                .log(user.id, {
                  targetId: refId,
                  targetType: 'entity_ref',
                  action: 'update',
                  field: 'condition',
                  oldValue: ref.condition,
                  newValue: input.condition,
                  description: `Mech loadout → ${input.condition}`,
                })
                .catch(() => {})
            }
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mech, user, chassisName, mechRefs, updateMechEntityRef]
  )

  const handleUpdateCrawler = useCallback(
    (input: Partial<CrawlerUpdate>) => {
      if (!crawler) return
      const crawlerLabel = crawler.name || 'Crawler'
      updateCrawlerMutation.mutate(
        { crawlerId: crawler.id, input },
        {
          onSuccess: () => showSaveToast(`${crawlerLabel} updated`),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawler, updateCrawlerMutation]
  )

  return {
    handleUpdateMech,
    handleUpdateMechEntityRef,
    handleUpdateCrawler,
  }
}
