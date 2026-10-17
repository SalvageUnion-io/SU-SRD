/**
 * HoldAdder — a Hold container's own intake form (`StorageManifest`).
 */

import type { CargoLot } from 'cantina-domain/schemas/cargoLot'
import { makeScrapLot, makeUnitLot } from 'cantina-domain/schemas/cargoLot'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { Button, Eyebrow, Input, Segmented, SegmentedOption, tokens } from '../index'

/** A slot cost is a non-negative INTEGER (`CargoLotSchema.units` is `.int()`). */
function coerceSlots(raw: string): number {
  const parsed = Math.trunc(Number(raw))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

// — The intake form —

const ADDER = {
  marginTop: tokens.space[12],
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space[8],
  borderRadius: tokens.radius.card,
  border: `${tokens.borderWidth.chrome} dashed ${tokens.color.wkFaint}`,
  padding: tokens.space[10],
} satisfies CSSProperties

/** A label's place beside its field. */
const ADDER_LABEL = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[4],
} satisfies CSSProperties

/** A compact `Input`: tighter and smaller than its own skin. */
const NAME_INPUT = { width: '144px', flex: 1 } satisfies CSSProperties

const NUMBER_INPUT = { width: '56px' } satisfies CSSProperties

/** Clamp a typed tech level to the 1–6 scrap range. */
function coerceTl(raw: string): number {
  const n = Math.trunc(Number(raw))
  if (!Number.isFinite(n)) return 1
  return Math.min(6, Math.max(1, n))
}

/**
 * HoldAdder — a container's own intake form, added straight into that
 * container. Needs NO counterpart on the other side of the boundary (the mech
 * hold works with no crawler; the Storage Bay works with no docked mech). A
 * Kind toggle picks what is entered:
 *   - `Cargo` (default) — a free-text SEALED unit lot (name + slot cost) via
 *     `makeUnitLot`, the original behaviour.
 *   - `Scrap` — an arbitrary bulk SCRAP lot at a chosen tech level (1–6) via
 *     `makeScrapLot`, so a crawler (or mech) can stow scrap by hand. This is
 *     the physical-cargo path; the crawler's abstract scrap POOL is edited
 *     separately by `ScrapPoolAdder`.
 * The verb is the side's intake word — 'Load' into the mech hold, 'Stow' into
 * the crawler Storage Bay.
 */
export function HoldAdder({
  onAdd,
  verb,
  containerLabel,
}: {
  onAdd: (lot: CargoLot) => void
  verb: string
  containerLabel: string
}) {
  const slotsId = useId()
  const tlId = useId()
  const [kind, setKind] = useState<'cargo' | 'scrap'>('cargo')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(1)
  const [tl, setTl] = useState(1)

  const canCommit = kind === 'scrap' ? amount > 0 : name.trim().length > 0

  function commit() {
    if (!canCommit) return
    if (kind === 'scrap') {
      onAdd(makeScrapLot(tl, amount))
    } else {
      onAdd(makeUnitLot(name.trim(), { units: coerceSlots(String(amount)) }))
    }
    setName('')
    setAmount(1)
  }

  return (
    <div style={ADDER}>
      {/* Kind toggle — Cargo (named lot) vs Scrap (TL bulk lot). */}
      <Segmented label="Cargo kind" size="compact">
        {(['cargo', 'scrap'] as const).map((k) => (
          <SegmentedOption key={k} pressed={kind === k} onClick={() => setKind(k)}>
            {k === 'cargo' ? 'Cargo' : 'Scrap'}
          </SegmentedOption>
        ))}
      </Segmented>

      {kind === 'cargo' ? (
        <Input
          size="compact"
          type="text"
          value={name}
          aria-label="New cargo name"
          placeholder="Cargo name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
          }}
          style={NAME_INPUT}
        />
      ) : (
        <Eyebrow as="label" tone="muted" htmlFor={tlId} style={ADDER_LABEL}>
          Tech
          <Input
            size="compact"
            id={tlId}
            type="number"
            numeric
            min={1}
            max={6}
            step={1}
            value={tl}
            aria-label="Scrap tech level"
            onChange={(e) => setTl(coerceTl(e.target.value))}
            style={NUMBER_INPUT}
          />
        </Eyebrow>
      )}

      <Eyebrow as="label" tone="muted" htmlFor={slotsId} style={ADDER_LABEL}>
        {kind === 'scrap' ? 'Qty' : 'Slots'}
        <Input
          size="compact"
          id={slotsId}
          type="number"
          numeric
          min={0}
          step={1}
          value={amount}
          aria-label={kind === 'scrap' ? 'Scrap quantity' : 'New cargo slot cost'}
          // `CargoLotSchema.units` is `.int()`, and a `type="number"` field still
          // accepts a typed "1.5". Without truncating here the lot fails its Zod
          // parse on commit — and since the form clears itself immediately, the
          // cargo would just vanish. Coerce at the edge instead.
          onChange={(e) => setAmount(coerceSlots(e.target.value))}
          style={NUMBER_INPUT}
        />
      </Eyebrow>
      <Button
        size="compact"
        disabled={!canCommit}
        aria-label={`${verb} ${kind} into the ${containerLabel}`}
        onClick={commit}
      >
        {verb}
      </Button>
    </div>
  )
}
