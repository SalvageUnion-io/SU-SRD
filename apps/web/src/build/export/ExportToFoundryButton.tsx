/**
 * ExportToFoundryButton — downloads a pilot or a mech as an Actor for Foundry
 * VTT's unofficial Salvage Union system (`lib/export/foundryActor.ts`). In
 * Foundry the player makes an empty Pilot or Mech and picks Import Data on it.
 *
 * A read: offered wherever the sheet's Export is, connected or not.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { Button, toast } from '../../components/index'
import { downloadJson } from '../../lib/export/downloadJson'
import { foundryFileName, mechToFoundry, pilotToFoundry } from '../../lib/export/foundryActor'
import { buildExportCopy } from '../../messages/build-export'

type ExportToFoundryButtonProps =
  | { kind: 'pilot'; entity: Pilot; crawler: Pick<Crawler, 'techLevel'> | null }
  | { kind: 'mech'; entity: Mech; pilotAbilities: string[] | undefined }

export function ExportToFoundryButton(props: ExportToFoundryButtonProps) {
  function handleExport() {
    const actor =
      props.kind === 'pilot'
        ? pilotToFoundry(props.entity, props.crawler)
        : mechToFoundry(props.entity, props.pilotAbilities)
    downloadJson(foundryFileName(props.kind, props.entity.name), actor)
    toast.success(
      buildExportCopy('exportedToFoundry', {
        name: props.entity.name,
        kind: props.kind === 'pilot' ? 'Pilot' : 'Mech',
      })
    )
  }

  return (
    <Button
      variant="ghost"
      aria-label={buildExportCopy('exportToFoundryLabel', { kind: props.kind })}
      onClick={handleExport}
    >
      {buildExportCopy('exportToFoundry')}
    </Button>
  )
}
