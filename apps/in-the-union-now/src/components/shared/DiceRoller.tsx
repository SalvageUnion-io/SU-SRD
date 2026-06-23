/**
 * DiceRoller — manual d20 / stat-check reference roller (REQ-027).
 *
 * A purely ephemeral utility surface: a floating launcher button opens a modal
 * that rolls a d20, optionally adds a flat stat/situational modifier, and shows
 * the Salvage Union Core Mechanic outcome band (Core Rulebook p.232). All state
 * is local `useState` — this component NEVER writes through entityStore /
 * workspaceStore and touches no IndexedDB record. It is a manual reference tool
 * with no game-state mutation, mounted globally from __root.tsx so it is
 * reachable on every route.
 *
 * Band labels/values come from the reference dataset's Core Mechanic table via
 * the pure rollCoreMechanic helper, not hardcoded UI strings.
 */

import { useState } from 'react'
import { Dices } from 'lucide-react'
import { ModalShell } from 'suref-react'

import { Button } from '../ui/button'
import { rollCoreMechanic } from './diceRollerHelpers'
import type { CoreMechanicRoll } from './diceRollerHelpers'

export function DiceRoller() {
  const [open, setOpen] = useState(false)
  const [modifier, setModifier] = useState(0)
  const [result, setResult] = useState<CoreMechanicRoll | null>(null)

  function handleRoll() {
    setResult(rollCoreMechanic(modifier))
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="icon"
        aria-label="Open dice roller"
        title="Dice roller"
        className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Dices aria-hidden="true" />
      </Button>

      <ModalShell
        open={open}
        onOpenChange={setOpen}
        title="Dice Roller"
        subtitle="Core Mechanic (d20)"
        description="Roll a d20 and read the Salvage Union Core Mechanic outcome. Reference only — nothing is saved."
        maxWidth="max-w-md"
        align="center"
      >
        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-muted-foreground">
            Manual reference roller — rolls a d20 and reads the Core Mechanic outcome band. Nothing
            is saved to your pilots, mechs, or crawlers.
          </p>

          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            <span>Modifier (stat check)</span>
            <input
              type="number"
              value={modifier}
              onChange={(e) => setModifier(Number(e.target.value) || 0)}
              className="w-20 rounded border border-[var(--color-su-black)] bg-transparent px-2 py-1 text-right text-sm"
              aria-label="Stat or situational modifier added to the d20"
            />
          </label>

          <Button type="button" variant="default" onClick={handleRoll} className="self-start">
            Roll d20
          </Button>

          {result && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-2 rounded border border-[var(--color-su-black)] p-3"
            >
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-medium">Roll:</span>
                <span>{result.roll}</span>
                {result.modifier !== 0 && (
                  <span className="text-muted-foreground">
                    {result.modifier > 0
                      ? `+ ${result.modifier}`
                      : `- ${Math.abs(result.modifier)}`}
                    {' = '}
                    <span className="font-medium text-foreground">{result.total}</span>
                  </span>
                )}
              </div>
              {result.label && <p className="text-base font-bold">{result.label}</p>}
              <p className="text-sm">{result.value}</p>
            </div>
          )}
        </div>
      </ModalShell>
    </>
  )
}
