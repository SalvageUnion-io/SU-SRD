/**
 * Canonical per-entity condition vocabulary (rules: Intact / Damaged /
 * Destroyed) — one source of truth for the tri-state status shared across the
 * atom set. `StatusBadge` (`EntityStatus`) and `Stat` (`StatState`) both
 * alias this so the vocabulary can never drift between them.
 */
export type EntityStatus = 'intact' | 'damaged' | 'destroyed'
