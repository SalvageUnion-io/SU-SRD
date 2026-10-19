/**
 * CargoLotLine — one cargo lot, drawn the one way wherever a hold lists it
 * (the mech and crawler Holds, a partner's hold). A lot is a carried thing the
 * reference does not hold (ruleset §6.6), so it is a Token from its synthetic
 * model on the sheet's item line (`SheetItemLine`): its Tech Level the rank
 * where it has one, `UNITS | 3` in the loadout lane, and a bulk lot whose
 * count is not its units its quantity as the state (`× | 6`). The host's moves
 * (Stow, Load, Unload, Unstow) are the chip group's last slot, at the Token's
 * Size (R6); in Read there are none.
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import type { ReactNode } from 'react'
import { Entity, Stat } from '../../components/index'
import { SheetItemLine } from './SheetItemLine'
import { syntheticItemModel } from './syntheticItem.model'

/** What a lot line reads off a lot. */
type LotFacts = Pick<CargoLot, 'id' | 'name' | 'units' | 'tl' | 'kind' | 'qty'>

export function CargoLotLine({ lot, actions }: { lot: LotFacts; actions?: ReactNode }) {
  const qty = lot.kind === 'bulk' && lot.qty !== undefined && lot.qty !== lot.units ? lot.qty : null
  const model = syntheticItemModel({
    name: lot.name,
    id: lot.id,
    schemaName: 'equipment',
    kind: 'Cargo',
    facts: [
      ...(lot.tl !== undefined ? [{ label: 'TL' as const, value: lot.tl }] : []),
      { label: 'Units', value: lot.units },
    ],
  })
  return (
    <li>
      <SheetItemLine
        token={
          <Entity
            form="token"
            context="loadout"
            model={model}
            mode={{ kind: 'read' }}
            state={
              qty !== null ? (
                <Stat orientation="horizontal" label="×" value={qty} size="mini" />
              ) : undefined
            }
          />
        }
        name={lot.name}
        readOnly={actions === undefined}
        actions={actions}
      />
    </li>
  )
}
