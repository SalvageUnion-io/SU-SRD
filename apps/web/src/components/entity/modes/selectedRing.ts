import type { CSSProperties } from 'react'

/**
 * SELECT's ring: the 3px ink ring just outside the frame, non-layout-shifting. The
 * one spelling of it as a style object — the Compact, the entity card, a choice
 * card and the searcher's installed count card all spread it.
 */
export const SELECTED_RING = { boxShadow: '0 0 0 3px var(--color-ink)' } satisfies CSSProperties

/**
 * SELECT's one dim (hard rule R15): an option the picker cannot take, demotes,
 * or has not chosen, dimmed and drained (`.su-select-dim`). The card's
 * `selectable={false}` draws it; a picker never sets an opacity of its own.
 */
export const SELECT_DIM = 'su-select-dim'
