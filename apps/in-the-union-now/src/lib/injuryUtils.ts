/**
 * Injury utility functions for the Critical Injury system.
 *
 * Pure functions for classifying injury rolls, applying injuries to
 * pilot stats, and healing injuries during downtime.
 *
 * Per the rules-engine-boundary ADR, the trigger (pilot reaches 0 HP)
 * is economic/automatic, but the consequence (roll result) requires
 * player confirmation before persisting.
 */

export type InjurySeverity = 'fatal' | 'major' | 'minor' | 'unconscious' | 'miraculous'

export type PilotInjury = {
  severity: 'minor' | 'major'
  maxHpReduction: number
}

/**
 * Classify a d20 roll on the Critical Injury Table (p.241).
 *
 * - 1: Fatal Injury
 * - 2-5: Major Injury (max HP reduced by 2, unconscious)
 * - 6-10: Minor Injury (max HP reduced by 1, unconscious)
 * - 11-19: Unconscious (0 HP, stable, no persistent injury)
 * - 20: Miraculous Survival (1 HP, conscious)
 */
export function classifyInjuryRoll(roll: number): InjurySeverity {
  if (roll === 1) return 'fatal'
  if (roll <= 5) return 'major'
  if (roll <= 10) return 'minor'
  if (roll <= 19) return 'unconscious'
  return 'miraculous'
}

/**
 * Apply an injury to a pilot's max HP.
 * - Minor: -1
 * - Major: -2
 * - Other results (fatal, unconscious, miraculous): no change
 * Result is clamped to a minimum of 1.
 */
export function applyInjuryToMaxHp(currentMaxHp: number, severity: InjurySeverity): number {
  if (severity === 'minor') return Math.max(1, currentMaxHp - 1)
  if (severity === 'major') return Math.max(1, currentMaxHp - 2)
  return currentMaxHp
}

/**
 * Check if an injury of a given severity can be healed at a given Med Bay tech level.
 * - Minor injuries: healed at Tech 3-4 Med Bay (TL >= 3)
 * - Major injuries: healed at Tech 5-6 Med Bay (TL >= 5)
 * - Other results (fatal, unconscious, miraculous): cannot be healed
 */
export function canHealInjury(severity: InjurySeverity, medBayTechLevel: number): boolean {
  if (severity === 'minor') return medBayTechLevel >= 3
  if (severity === 'major') return medBayTechLevel >= 5
  return false
}

/**
 * Create a PilotInjury from a roll result string.
 * Returns null for results that don't produce persistent injuries
 * (fatal, unconscious, miraculous).
 */
export function createInjuryFromRoll(result: InjurySeverity): PilotInjury | null {
  if (result === 'minor') return { severity: 'minor', maxHpReduction: 1 }
  if (result === 'major') return { severity: 'major', maxHpReduction: 2 }
  return null
}

/**
 * Compute injury healing during downtime at a Med Bay.
 *
 * - Minor injuries: healed at Tech 3-4 Med Bay (TL >= 3)
 * - Major injuries: healed at Tech 5-6 Med Bay (TL >= 5)
 */
export function computeInjuryHealingUpdate(
  injuries: PilotInjury[],
  currentMaxHp: number,
  medBayTechLevel: number
): {
  remainingInjuries: PilotInjury[]
  healedCount: number
  maxHpRestored: number
  newMaxHp: number
} {
  let maxHpRestored = 0
  const remainingInjuries: PilotInjury[] = []

  for (const injury of injuries) {
    if (canHealInjury(injury.severity, medBayTechLevel)) {
      maxHpRestored += injury.maxHpReduction
    } else {
      remainingInjuries.push(injury)
    }
  }

  return {
    remainingInjuries,
    healedCount: injuries.length - remainingInjuries.length,
    maxHpRestored,
    newMaxHp: currentMaxHp + maxHpRestored,
  }
}

/**
 * Check if a pilot has any active (unhealed) injuries.
 */
export function hasActiveInjuries(injuries: PilotInjury[] | null): boolean {
  return !!injuries && injuries.length > 0
}

/**
 * Get a human-readable label for an injury severity.
 */
export function injuryLabel(severity: InjurySeverity): string {
  return severity === 'minor' ? 'Minor Injury' : 'Major Injury'
}

/**
 * Get the injuries array from a pilot row's injuries JSONB column.
 * Returns an empty array if null/undefined/empty.
 */
export function getInjuries(pilot: { injuries?: PilotInjury[] | null }): PilotInjury[] {
  if (!pilot.injuries || !Array.isArray(pilot.injuries) || pilot.injuries.length === 0) return []
  return pilot.injuries
}

/**
 * Get a human-readable label for a roll result.
 */
export function getInjuryRollLabel(result: InjurySeverity): string {
  switch (result) {
    case 'fatal':
      return 'Fatal Injury'
    case 'major':
      return 'Major Injury'
    case 'minor':
      return 'Minor Injury'
    case 'unconscious':
      return 'Unconscious'
    case 'miraculous':
      return 'Miraculous Survival'
  }
}

/**
 * Get a human-readable description for a roll result.
 */
export function getInjuryRollDescription(result: InjurySeverity): string {
  switch (result) {
    case 'fatal':
      return 'Your Pilot suffers a fatal injury and dies.'
    case 'major':
      return 'You suffer a Major Injury such as permanent scarring, broken ribs, or internal injuries. Your Max HP is reduced by 2 until healed in a Tech 5-6 Med Bay. In addition, you are Unconscious.'
    case 'minor':
      return 'You suffer a Minor Injury such as a sprain, burns, or minor concussion. Your Max HP is reduced by 1 until healed in a Tech 3-4 Med Bay. In addition, you are Unconscious.'
    case 'unconscious':
      return 'You are stable at 0 HP, but unconscious and cannot move or take actions until you gain at least 1 HP. You will regain consciousness naturally in 1 hour and get back up with 1 HP.'
    case 'miraculous':
      return 'You survive against the odds. You have 1 HP, remain conscious and can act normally.'
  }
}
