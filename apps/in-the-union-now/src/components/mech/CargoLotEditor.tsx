import { useState } from 'react'
import { Btn, Field, Input } from 'suref-react'
import type { CargoLot, CargoLotCategory } from '../../lib/schemas/cargoLot'
import { makeScrapLot, makeUnitLot, totalLotUnits } from '../../lib/schemas/cargoLot'
import { cn } from '../../lib/utils'

const CATEGORIES: CargoLotCategory[] = ['SEALED', 'SCRAP', 'POWER', 'SYSTEM']

type CargoLotEditorProps = {
  lots: CargoLot[]
  onChange: (lots: CargoLot[]) => void
  className?: string
}

/**
 * Edits the mech's starting cargo as cargo lots (design §2.12, plan 2.3):
 * SCRAP entries become bulk lots carrying the mandatory tech level (1 unit
 * per scrap on a mech); everything else becomes an atomic unit-lot in the
 * chosen category. Capacity is NOT enforced here — over-capacity surfaces
 * as a soft warning at review (warn, never block).
 */
export function CargoLotEditor({ lots, onChange, className }: CargoLotEditorProps) {
  const [name, setName] = useState('')
  const [cat, setCat] = useState<CargoLotCategory>('SEALED')
  const [tl, setTl] = useState(1)
  const [units, setUnits] = useState(1)

  function addLot() {
    const lot =
      cat === 'SCRAP'
        ? makeScrapLot(tl, units)
        : makeUnitLot(name.trim() || 'Cargo', { cat, units })
    if (cat !== 'SCRAP' && name.trim() === '') return
    onChange([...lots, lot])
    setName('')
    setUnits(1)
  }

  function removeLot(id: string) {
    onChange(lots.filter((lot) => lot.id !== id))
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Existing lots */}
      {lots.length === 0 ? (
        <p className="text-xs text-wk-muted">No cargo stowed.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {lots.map((lot) => (
            <li
              key={lot.id}
              data-testid="cargo-lot"
              className="flex items-center gap-3 rounded-[2px] border-[1.5px] border-ink bg-paper px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-cond text-sm font-bold uppercase text-ink">
                  {lot.name}
                  {lot.kind === 'bulk' && lot.qty !== undefined && ` ×${lot.qty}`}
                </span>
                <span className="block font-mono text-[10px] uppercase text-wk-muted">
                  {lot.cat}
                  {lot.tl !== undefined && ` T${lot.tl}`} · {lot.code}
                </span>
              </span>
              <span className="shrink-0 font-mono text-sm font-bold text-ink">
                {lot.units}
                <span className="text-[10px] text-wk-muted">U</span>
              </span>
              <Btn
                variant="ghost"
                size="sm"
                aria-label={`Remove ${lot.name}`}
                onClick={() => removeLot(lot.id)}
              >
                Remove
              </Btn>
            </li>
          ))}
        </ul>
      )}

      {/* Add-lot form */}
      <div className="flex flex-wrap items-end gap-2">
        {cat !== 'SCRAP' && (
          <Field label="Item name" htmlFor="cargo-lot-name" className="min-w-40 flex-1">
            <Input
              id="cargo-lot-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addLot()
                }
              }}
            />
          </Field>
        )}
        <Field label="Category" htmlFor="cargo-lot-cat">
          <select
            id="cargo-lot-cat"
            value={cat}
            onChange={(e) => setCat(e.target.value as CargoLotCategory)}
            className="rounded-[3px] border-[1.5px] border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        {cat === 'SCRAP' && (
          <Field label="Tech level" htmlFor="cargo-lot-tl">
            <select
              id="cargo-lot-tl"
              value={tl}
              onChange={(e) => setTl(Number(e.target.value))}
              className="rounded-[3px] border-[1.5px] border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  TL{n}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={cat === 'SCRAP' ? 'Scrap (units)' : 'Units'} htmlFor="cargo-lot-units">
          <Input
            id="cargo-lot-units"
            type="number"
            min={1}
            value={units}
            onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-20"
          />
        </Field>
        <Btn onClick={addLot} aria-label="Add cargo lot">
          Add
        </Btn>
      </div>

      <p className="font-mono text-[11px] uppercase text-wk-muted">
        {lots.length} lot{lots.length === 1 ? '' : 's'} · {totalLotUnits(lots)} units
      </p>
    </div>
  )
}
