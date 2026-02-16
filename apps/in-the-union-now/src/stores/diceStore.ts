import { create } from 'zustand'
import { rollD20 } from '../lib/pilotUtils'

type RollResult = {
  value: number
  tier: string
  tierColor: string
  context?: string
  pushed?: boolean
}

type DiceState = {
  isOpen: boolean
  results: RollResult[]
  currentResult: RollResult | null
  canPush: boolean
  open: () => void
  close: () => void
  roll: (context?: string) => void
  push: () => RollResult
  clearResults: () => void
}

function getTier(value: number): { tier: string; tierColor: string } {
  if (value === 1) return { tier: 'Cascade Failure', tierColor: 'text-roll-cascade' }
  if (value <= 5) return { tier: 'Failure', tierColor: 'text-roll-failure' }
  if (value <= 10) return { tier: 'Tough Choice', tierColor: 'text-roll-tough' }
  if (value <= 19) return { tier: 'Success', tierColor: 'text-roll-success' }
  return { tier: 'Nailed It', tierColor: 'text-roll-nailed' }
}

export const useDiceStore = create<DiceState>((set, get) => ({
  isOpen: false,
  results: [],
  currentResult: null,
  canPush: false,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  roll: (context?: string) => {
    const value = rollD20()
    const { tier, tierColor } = getTier(value)
    const result: RollResult = { value, tier, tierColor, context }

    set((state) => ({
      isOpen: true,
      currentResult: result,
      canPush: true,
      results: [result, ...state.results].slice(0, 20),
    }))
  },

  push: () => {
    const value = rollD20()
    const { tier, tierColor } = getTier(value)
    const result: RollResult = {
      value,
      tier,
      tierColor,
      context: get().currentResult?.context,
      pushed: true,
    }

    set((state) => ({
      currentResult: result,
      canPush: false,
      results: [result, ...state.results].slice(0, 20),
    }))

    // Return the result so the caller can handle heat (+2) and heat check
    return result
  },

  clearResults: () => set({ results: [], currentResult: null, canPush: false }),
}))
