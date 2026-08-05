/**
 * Take Damage / Critical Damage / Critical Injury rules (design-review R-1).
 *
 * Moved to packages/salvageunion-reference/lib/rules/takeDamage.ts (ADR-006).
 * Thin re-export shim — see that module for the implementation.
 */

export type {
  CriticalDamageEffect,
  CriticalInjuryEffect,
  DamageKind,
  MechDamageEffect,
  MechDamageInput,
  PilotDamageEffect,
  PilotDamageInput,
} from 'salvageunion-reference/rules'
export {
  applyMechDamage,
  applyPilotDamage,
  criticalDamageOutcome,
  criticalInjuryOutcome,
  mechEffectiveDamage,
  performCriticalDamage,
  performCriticalInjury,
  pilotEffectiveDamage,
} from 'salvageunion-reference/rules'
