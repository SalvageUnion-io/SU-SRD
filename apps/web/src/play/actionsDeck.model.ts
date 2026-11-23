/**
 * The shapes `useActionsDeck` takes and hands on: its props, the deck, and the
 * pure `ResolveModel` that `PlayResolveSteps` draws (play.md §5).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import type { SeatResolving } from 'game-domain/schemas/seat'
import type { rollForTable } from '../components/index'
import type { PlayStore } from './play.model'
import type { Situation } from './situation.model'
import type { SalvageAreaView } from './useSalvageArea'

export type ResolveModel =
  | { kind: 'idle' }
  | {
      /** The seat names an action the deck no longer has: say so, and let it go. */
      kind: 'orphan'
      text: string
      onClear: () => void
    }
  | {
      kind: 'resolve'
      onBack: () => void
      /**
       * What activating spends, each 0 when it spends none: `amount` of the
       * `currency`, the Heat it adds, and its uses; `usesLeft` is what remains
       * of them where they are counted. Drawn by `ResolveSpend`.
       */
      cost: { amount: number; heat: number; uses: number; usesLeft?: number }
      /** It costs nothing: there is no Activate step, Roll alone (r4 A2). */
      free: boolean
      /**
       * An attack, which always rolls (it deals damage): Roll the die pays its
       * cost, so it is the one main button and there is no Activate (r5 A16).
       */
      rollLeads: boolean
      /** What pressing Roll will spend, while the cost is unpaid; null when nothing. */
      rollSpends: string | null
      /** What this activation spends: the mech's EP or the pilot's AP. */
      currency: 'EP' | 'AP'
      /** EP-vs-AP cost radio for `activationCurrency === 'EP or AP'` actions. */
      currencyChoice?: {
        epCost: number
        currency: 'EP' | 'AP'
        pilotAvailable: boolean
        activated: boolean
        onCurrency: (c: 'EP' | 'AP') => void
      }
      /** `− X +` Hot(X) stepper + heat projection for variable-Heat actions. */
      variableHot?: {
        hotX: number
        activated: boolean
        projText: string
        over: boolean
        onDec: () => void
        onInc: () => void
      }
      controls: {
        activateDisabled: boolean
        activateTitle?: string
        onActivate: () => void
        onRoll: () => void
        /** Why Roll is refused: it would pay a cost that cannot be paid now. */
        rollLockedReason?: string
        /**
         * Mech actions only (pilots cannot Push, Core Book p.233). Disabled
         * before a roll, once this roll is pushed, and where +2 Heat would
         * pass the Heat Cap (Quick Ref p.233).
         */
        push?: {
          disabled: boolean
          pushed: boolean
          onPush: () => void
          /** Why Push is refused at this Heat, or undefined when it is not. */
          lockedReason?: string
        }
        /** The activation is paid (or the action needs none paid). */
        activated: boolean
        applyLabel: string
        applyDisabled: boolean
        onApply: () => void
        onClear: () => void
      }
      roll?: {
        roll: number
        band: string
        /** The band's span on the d20, as the book prints it ("11–19"). */
        bandRange: string
        bandLabel: string
        bandSummary: string
        /** A Cascade Failure: Apply hands it to the Compact's Callout, never writes it. */
        destructive: boolean
      } | null
      pushLog?: string | null
      /** An Area Salvage: the area, its own table's roll, and what Apply carried. */
      salvage?: {
        /** The area its Supply is spent from; null when there is none to salvage. */
        area: SalvageArea | null
        /** Name or change the area: the Mediator's in a Game, so a solo screen's only. */
        onSetArea?: (area: SalvageArea) => void
        /** The Area Salvage d20, once rolled. */
        roll: number | null
        /** The rolled row, as the screen reader says it. */
        rolled: { label: string; text: string } | null
      }
      /** A Push's Heat Check melted the reactor down; the player confirms it. */
      meltdown?: { onConfirm: () => void; onDismiss: () => void } | null
      applied: boolean
      applyRouted: boolean
      /** The roll writes nothing to any unit: no Apply, nor its note (r6 A5). */
      nothingToApply: boolean
      /** What the row says when the roll closes it, nothing being left to do; null while it stays. */
      closesItself: string | null
      /** Something was done with it (activated, rolled): its close reads Done, never Cancel. */
      progressed: boolean
    }

export type ActionsDeckProps = {
  /** The boarded mech; on foot, the assigned one or null with none. */
  mech: Mech | null
  /** The pilot; on foot the deck lists only their actions. */
  pilot?: Pilot | null
  /** The pilot's crawler — its tier drives Stat Training (max AP). */
  crawler?: Crawler | null
  /** What the pilot is doing: on foot, Boarded or in Downtime. */
  situation: Situation
  /** The resolve in progress, read from the seat. */
  resolving: SeatResolving | null
  /** Record the resolve on the seat; null when it is over. */
  onResolving: (resolving: SeatResolving | null) => void
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
  /** The dice for a table roll, by name; injectable for tests (default `rollForTable`). */
  rollFor?: typeof rollForTable
  /** The Scene's Heat multiplier (`sceneHeatScale`: 2 Radiation Storm, ½ Freezing), Hot and Push; 1 by default. */
  heatScale?: number
  /** The area an Area Salvage spends Supply from; absent where no area is read. */
  salvageArea?: SalvageAreaView
}

export type ActionsDeck = {
  /** Open an action's resolve on the seat, by its key. */
  open: (key: string) => void
  resolve: ResolveModel
  /** The action that just finished (applied, and closed itself): its row says Done until another opens. */
  doneKey: string | null
  /** What the finished row says: "Result applied", or the roll that closed itself (r6 A5). */
  doneSays: string
}
