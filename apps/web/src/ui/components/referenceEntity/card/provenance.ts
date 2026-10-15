/**
 * Card PROVENANCE — the one place a source/booklet/page triple turns into the
 * printed `Salvage Union Starter Set (PH) · p.38` line, and the rule that a
 * pattern's provenance and its chassis's are never mixed.
 *
 * Both live in the entity model (`salvageunion-reference`,
 * `lib/view/parts/cite.ts`); the card's identity footer reads them from here.
 */

export {
  type AdditionalSource,
  formatProvenance,
  resolveAdditionalSources,
  resolveProvenance as resolveFooterProvenance,
} from 'salvageunion-reference'
