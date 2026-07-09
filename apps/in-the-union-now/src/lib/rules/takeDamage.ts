/**
 * Take Damage / Critical Damage / Critical Injury rules (design-review R-1).
 *
 * Moved to packages/salvageunion-reference/lib/rules/takeDamage.ts (ADR-006).
 * Thin re-export shim — see that module for the implementation.
 */

export {
  mechEffectiveDamage,
  applyMechDamage,
  criticalDamageOutcome,
  performCriticalDamage,
  pilotEffectiveDamage,
  applyPilotDamage,
  criticalInjuryOutcome,
  performCriticalInjury,
} from 'salvageunion-reference'
export type {
  DamageKind,
  MechDamageInput,
  MechDamageEffect,
  PilotDamageInput,
  PilotDamageEffect,
  CriticalDamageEffect,
  CriticalInjuryEffect,
} from 'salvageunion-reference'
