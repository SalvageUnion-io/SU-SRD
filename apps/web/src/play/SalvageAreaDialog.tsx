/**
 * SalvageAreaDialog — name the area the table is salvaging (Core Book p.245):
 * what it is called, the Tech Level of what is found there, and its Supply,
 * how many Area Salvage rolls it has left (5 unless the Mediator says
 * otherwise). The Mediator's in a Game (the Opposition's Area), a solo
 * player's from the Area Salvage resolve. Keyed by the caller on its opening,
 * so it starts from the area as it stands.
 */

import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import { DEFAULT_AREA_SUPPLY, MAX_AREA_SUPPLY } from 'game-domain/schemas/salvageArea'
import { useId, useState } from 'react'
import { ConfirmDialog, Eyebrow, Input, Select, Stack } from '../components/index'
import { playCopy } from '../messages/play'

const TECH_LEVELS = [1, 2, 3, 4, 5, 6] as const

type SalvageAreaDialogProps = {
  open: boolean
  /** The area as it stands, or null when there is none yet. */
  area: SalvageArea | null
  onClose: () => void
  onSave: (area: SalvageArea) => void
}

export function SalvageAreaDialog({ open, area, onClose, onSave }: SalvageAreaDialogProps) {
  const id = useId()
  const [name, setName] = useState(area?.name ?? '')
  const [techLevel, setTechLevel] = useState(area?.techLevel ?? 1)
  const [supply, setSupply] = useState(area?.supply ?? DEFAULT_AREA_SUPPLY)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={playCopy('setTheArea')}
      body={
        <Stack gap={8}>
          <p>{playCopy('salvageAreaLede')}</p>
          <Eyebrow as="label" tone="muted" htmlFor={`${id}-name`}>
            {playCopy('salvageAreaName')}
          </Eyebrow>
          <Input
            id={`${id}-name`}
            value={name}
            maxLength={60}
            autoComplete="off"
            placeholder={playCopy('salvageAreaNamePlaceholder')}
            onChange={(e) => setName(e.target.value)}
          />
          <Eyebrow as="label" tone="muted" htmlFor={`${id}-tl`}>
            {playCopy('salvageAreaTechLevel')}
          </Eyebrow>
          <Select
            id={`${id}-tl`}
            value={techLevel}
            onChange={(e) => setTechLevel(Number(e.target.value))}
          >
            {TECH_LEVELS.map((tl) => (
              <option key={tl} value={tl}>
                {playCopy('salvageAreaTech', { tl })}
              </option>
            ))}
          </Select>
          <Eyebrow as="label" tone="muted" htmlFor={`${id}-supply`}>
            {playCopy('salvageAreaSupply')}
          </Eyebrow>
          <Input
            id={`${id}-supply`}
            type="number"
            numeric
            min={0}
            max={MAX_AREA_SUPPLY}
            value={supply}
            onChange={(e) =>
              setSupply(Math.min(MAX_AREA_SUPPLY, Math.max(0, Math.trunc(Number(e.target.value)))))
            }
          />
        </Stack>
      }
      confirmLabel={playCopy('salvageAreaSet')}
      onConfirm={() => {
        onSave({ name: name.trim(), techLevel, supply })
      }}
    />
  )
}
