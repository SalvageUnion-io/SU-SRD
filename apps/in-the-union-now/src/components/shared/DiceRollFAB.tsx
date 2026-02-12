import { Dice5 } from 'lucide-react'
import { useDiceStore } from '../../stores/diceStore'

export function DiceRollFAB() {
  const roll = useDiceStore((s) => s.roll)

  return (
    <button
      onClick={() => roll()}
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-su-orange text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      aria-label="Roll d20"
    >
      <Dice5 className="h-7 w-7" />
    </button>
  )
}
