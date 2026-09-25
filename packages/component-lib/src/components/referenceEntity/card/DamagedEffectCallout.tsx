import { ghostActionTone } from './entityCardTone'

/**
 * CRAWLER BAY "WHEN DAMAGED" callout — action-card style (ghosted bands +
 * black name-tab + paper body), tinted from the RED danger token
 * (`--color-status-bad`) so it clearly signals the damaged effect. The card
 * filters the same string out of its body prose, so it is said once.
 */
export function DamagedEffectCallout({ effect }: { effect: string }) {
  const bands = ghostActionTone('var(--color-status-bad)')
  return (
    <div className="overflow-hidden rounded-card" style={{ border: `3px solid ${bands.frame}` }}>
      <div className="flex items-center px-3 py-1.5" style={{ backgroundColor: bands.header }}>
        <span
          className="block bg-ink px-1 py-0.5 font-cond text-xs font-bold uppercase tracking-caps-tight text-paper"
          style={{ lineHeight: 1 }}
        >
          When Damaged
        </span>
      </div>
      <p className="bg-paper p-2 text-xs leading-snug text-ink">{effect}</p>
    </div>
  )
}
