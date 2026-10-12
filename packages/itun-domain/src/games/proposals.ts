/**
 * Proposals, as both ends of propose-and-confirm read them (ADR-030 §4,
 * docs/architecture/mediator-dashboard.md Q8).
 *
 * Shared by the server (`convex/proposals.ts` reads the reason cap) and the
 * Mediator's surfaces (the propose dock, the Proposals tab, the Game page's
 * "Proposals you sent"), so the field names, their labels and the state words
 * are one list. Pure: no React, no Convex.
 */

/** How many proposals one page of a sent list adds. */
export const PROPOSALS_PAGE = 20

/** The longest reason a proposal may carry, after trimming. */
export const PROPOSAL_REASON_MAX = 140

/**
 * The live-play fields a Mediator may propose a change to, per target kind.
 *
 * **These are Zod field names and the casing is load-bearing**: `currentHp`
 * names nothing on `PilotSchema`, and `proposals.apply` parses the merged body
 * and refuses a field the schema has no room for.
 */
export const PROPOSAL_FIELDS = {
  pilot: [
    { field: 'currentHP', label: 'HP' },
    { field: 'currentAP', label: 'AP' },
  ],
  mech: [
    { field: 'currentSP', label: 'SP' },
    { field: 'currentHeat', label: 'Heat' },
  ],
} as const

export type ProposalTargetKind = keyof typeof PROPOSAL_FIELDS

export type ProposalField = (typeof PROPOSAL_FIELDS)[ProposalTargetKind][number]['field']

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  [...PROPOSAL_FIELDS.pilot, ...PROPOSAL_FIELDS.mech].map((f) => [f.field, f.label])
)

/** "HP" for `currentHP`; an unknown field reads as itself. */
export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field
}

/** A proposal's state, in words. `proposed` reads Pending. */
export const PROPOSAL_STATE_WORD = {
  proposed: 'Pending',
  applied: 'Applied',
  declined: 'Declined',
  superseded: 'Superseded',
} as const

/**
 * The reason as it is stored: trimmed, and absent when blank. Throws past the
 * cap rather than cutting, so nobody's words are silently shortened.
 */
export function normalizeReason(reason: string | undefined): string | undefined {
  const trimmed = reason?.trim() ?? ''
  if (trimmed.length === 0) return undefined
  if (trimmed.length > PROPOSAL_REASON_MAX) {
    throw new RangeError(`A reason is at most ${PROPOSAL_REASON_MAX} characters`)
  }
  return trimmed
}

/** One field on one target: what it holds now, and its derived maximum. */
export type TargetReading = { current: number | null; max: number | null }

/** Something a proposal can be aimed at: a claimed pilot or mech. */
export type ProposalTarget = {
  /** The Convex row id `proposals.propose` addresses it by. */
  id: string
  kind: ProposalTargetKind
  /** "Pickle", or a mech by its pilot: "Pickle's Spectrum". */
  label: string
  /** The pilot this target belongs to, so a seat card can pick it. */
  pilotLinkId: string | null
  readings: Partial<Record<ProposalField, TargetReading>>
}

/** The slice of `crew.vitals` the targets are built from. */
export type TargetCrew = {
  pilots: ReadonlyArray<{
    _id: string
    linkId: string | null
    ownerId: string | null
    name: string
    mechId: string | null
    currentHP: number | null
    maxHP: number | null
    currentAP: number | null
    maxAP: number | null
  }>
  mechs: ReadonlyArray<{
    _id: string
    linkId: string | null
    ownerId: string | null
    name: string
    currentSP: number | null
    maxSP: number | null
    currentHeat: number | null
    maxHeat: number | null
  }>
}

/**
 * Every pilot and mech somebody can answer for, pilots first.
 *
 * Unclaimed ones are left out: a proposal needs an owner to apply or decline
 * it, and the server refuses one with none. A mech is labelled by the pilot it
 * is assigned to, because that is who the Mediator is looking at.
 */
export function proposalTargets(crew: TargetCrew | null): ProposalTarget[] {
  if (crew === null) return []
  const pilotOfMech = new Map<string, { name: string; linkId: string | null }>()
  for (const p of crew.pilots) {
    if (p.mechId !== null) pilotOfMech.set(p.mechId, { name: p.name, linkId: p.linkId })
  }
  const pilots = crew.pilots
    .filter((p) => p.ownerId !== null)
    .map(
      (p): ProposalTarget => ({
        id: p._id,
        kind: 'pilot',
        label: p.name,
        pilotLinkId: p.linkId,
        readings: {
          currentHP: { current: p.currentHP, max: p.maxHP },
          currentAP: { current: p.currentAP, max: p.maxAP },
        },
      })
    )
  const mechs = crew.mechs
    .filter((m) => m.ownerId !== null)
    .map((m): ProposalTarget => {
      const pilot = m.linkId === null ? undefined : pilotOfMech.get(m.linkId)
      return {
        id: m._id,
        kind: 'mech',
        label: pilot === undefined ? m.name : `${pilot.name}'s ${m.name}`,
        pilotLinkId: pilot?.linkId ?? null,
        readings: {
          currentSP: { current: m.currentSP, max: m.maxSP },
          currentHeat: { current: m.currentHeat, max: m.maxHeat },
        },
      }
    })
  return [...pilots, ...mechs]
}

/**
 * The value a proposal asks for, as a whole number from 0 to the field's
 * maximum (when it is known). Null for anything that is not a number.
 */
export function clampProposalValue(raw: string, max: number | null): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  const whole = Math.round(n)
  const floor = Math.max(0, whole)
  return max === null ? floor : Math.min(floor, max)
}
