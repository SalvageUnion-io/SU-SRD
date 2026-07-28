import { statesMechanicalChange } from '../lib/rules/rulesBearing.js'

/**
 * Rules-parity audit (ADR-029 §5) — does content DENOTE the mechanical change
 * its rules text claims?
 *
 * The dataset states mechanical changes in prose. Some are encoded as structured
 * data the app can apply (`contributions`, `statBonus`, crawler `mutations`,
 * choice `effects`); some are stated and encoded nowhere, so the number on the
 * sheet is simply wrong. Nothing previously told the two apart, which is how
 * Beefcake sat inert for the app's whole life.
 *
 * This is the check that makes "content denotes what it claims" STAY true across
 * future content drops, rather than being a one-time sweep that silently rots.
 *
 * **It never infers a number from prose.** It only asks whether a record whose
 * text plainly states a mechanical change carries structured data OR a reasoned
 * exemption. Authoring the number is a human decision; this only refuses to let
 * one be forgotten.
 *
 * Burn-down, like `check:design-tokens`: a KNOWN set is tolerated so the check
 * can land while the backlog is worked off, and anything NEW fails immediately.
 */

type Json = Record<string, unknown>

/**
 * Data files whose records are PLAYER content the app derives numbers from.
 *
 * Deliberately excludes adversary stat blocks (npcs, creatures, squads,
 * bio-titans, vehicles) and prose surfaces (keywords, guides, roll-tables).
 * Those state effects a Mediator APPLIES during play — "the target gains the
 * Vulnerable Trait" — which is procedural adjudication (ADR-021), surfaced and
 * never enforced. Auditing them would demand structured data for rules the app
 * is deliberately not automating, drowning the real backlog in noise.
 */
const PLAYER_CONTENT = new Set([
  'abilities.json',
  'systems.json',
  'modules.json',
  'equipment.json',
  'chassis.json',
  'crawlers.json',
  'crawler-bays.json',
  'drones.json',
])

export type ParityClass = 'cap' | 'effect'

export type ParityFinding = {
  /** Display name of the owning record. */
  record: string
  /** Data file the record lives in, e.g. `abilities.json`. */
  schema: string
  /** The sentence that states the change — quoted so triage needs no lookup. */
  sentence: string
  klass: ParityClass
  /** True when the record carries structured data for this class. */
  encoded: boolean
  /** Set when the record is deliberately exempt; the string is the reason. */
  exempt?: string
}

/**
 * Records whose text states a change that is deliberately NOT encoded.
 *
 * Every entry needs a reason, and each reason is a CLASS of exemption
 * established by a real record — not a one-off excuse. Adding an entry is a
 * design decision; adding one without a reason is not possible.
 */
export const PARITY_EXEMPTIONS: Record<string, string> = {
  // Chassis-integrated: the bonus is already folded into the chassis's own
  // absolute stat. Verified: Mule cargoCapacity IS 16, Gopher 12, Atlas 30.
  // Encoding these as contributions would DOUBLE-COUNT them.
  'Integrated Cargo Bay': 'chassis-integrated — already the absolute chassis stat',
  'Integrated Expanded Transport Hold': 'chassis-integrated — already the absolute chassis stat',
  'Integrated Colossal Cargo Bay': 'chassis-integrated — already the absolute chassis stat',

  // Current-pool effects: these move or restore a CURRENT pool, or read a cap
  // without changing it. Not a maximum, so not a contribution.
  'Parasitic Membrane': 'current-pool effect — transfers EP between mechs',
  'Bio-Maw': 'current-pool effect — regains SP, does not raise the cap',
  'Power Transference Cable': 'current-pool effect — moves EP up to the existing Max EP',

  // Already modelled by another mechanic.
  'Rad Wave Generator': 'inflicts Major Injuries — the injury penalty already applies',

  // Effect-of-an-effect: modifies another effect's OUTPUT, not a stat.
  Mender: 'effect-of-an-effect — changes how much a healing ability restores, not a stat',

  // Duration-bound: ephemeral play state owned by the Dashboard (ADR-019), not
  // the data-layer cap engine. In scope as `duration: activated` (F1), not here.
  'Squeeze it in': 'duration-bound — 12h activated effect, Dashboard play state (F1)',
  'Hull Magnetiser': 'duration-bound — 1h toggleable effect, Dashboard play state (F1)',

  // Grant at a moment: a one-off improvement applied WHEN it happens, not a
  // standing modifier. Encoding it as standing would re-apply it forever.
  'Pilot Bay': 'grant-at-a-moment — a one-off +2 HP / +1 AP improvement',

  // Target-applied: the effect lands on an OPPONENT during play ("the target
  // falls Prone and gains the Immobile Trait"). Procedural adjudication
  // (ADR-021) — surfaced as tooling, never enforced on a player's sheet, and
  // never a property of the player's own derived state.
  'Bio-Rifle': 'target-applied — inflicts an injury on the target, adjudicated',
  "Can't Stop, Won't Stop": 'target-applied — the TARGET gains Vulnerable',
  'Servo Lasso': 'target-applied — the TARGET falls Prone and gains a Trait',
  'Hydraulic Shunter': 'target-applied — the TARGET falls Prone and gains a Trait',

  // Conditional: the benefit is gated on a situation the app does not track
  // ("in consecutive turns", "whilst stabilised"). ADR-029 forbids inferring a
  // number from prose, and a conditional bonus has no flat value to encode.
  'CACB Laser': 'conditional — only on consecutive hits against the same target',
  'Stabilising Locomotion System': 'conditional — only the first attack whilst stabilised',

  // Effect-of-an-effect: modifies ANOTHER system's output rather than a stat.
  'Offensive Protocols': "effect-of-an-effect — raises a Weapons System's damage, not a stat",

  // Activated: a per-use choice, not a standing property. Belongs to Dashboard
  // play state (ADR-019) with the other duration-bound effects (F1).
  Snipe: 'activated — a per-attack Range Band increase, chosen at use',
  'Weapon Guidance': 'activated — grants Guided to a chosen system when activated',
}

/**
 * The remaining backlog — records that state a change, are not exempt, and are
 * not yet encodable.
 *
 * Both need the SAME missing capability, and it is not the one the plan assumed.
 * The plan called for "effects declarable directly on a system/ability" (C3),
 * but declaring them is not the blocker: `ChoiceEffectSchema` has no TARGET, and
 * neither of these effects lands on the record that declares it.
 *
 *   Bio-Wings         "Your Mech gains the Fly Trait" — targets the HOST MECH.
 *                     Declared as a self-effect it would say the Bio-Wings
 *                     system flies, which is wrong, not merely incomplete.
 *   High Gain Antenna raises the Range band of OTHER installed Modules and
 *                     Pilot Abilities, filtered by trait — cross-item targeting
 *                     with a predicate.
 *
 * So closing these needs effects to gain a `target` (the same concept
 * `ContributionSchema` already carries), not just a new place to declare them.
 * Encoding them without it would apply real rules to the wrong entity — a
 * silent wrong answer, which is worse than a visible gap.
 *
 * A name that becomes encoded must be REMOVED from this list; the runner fails
 * on a stale entry, because a burn-down list that never shrinks is not burning
 * down.
 */
export const KNOWN_UNRESOLVED: readonly string[] = ['Bio-Wings', 'High Gain Antenna']

function textOf(value: unknown, acc: string[]): void {
  if (typeof value === 'string') acc.push(value)
  else if (Array.isArray(value)) for (const v of value) textOf(v, acc)
  else if (value && typeof value === 'object')
    for (const v of Object.values(value as Json)) textOf(v, acc)
}

/** Split into sentences so a finding can quote the exact claim. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function hasCapData(record: Json): boolean {
  return (
    Array.isArray(record.contributions) ||
    (record.statBonus !== undefined && record.statBonus !== null) ||
    Array.isArray(record.mutations)
  )
}

function hasEffectData(record: Json): boolean {
  const choices = record.choices
  if (!Array.isArray(choices)) return false
  return choices.some((choice) => {
    const options = (choice as Json)?.choiceOptions
    return (
      Array.isArray(options) &&
      options.some((o) => Array.isArray((o as Json)?.effects) && (o as Json).effects !== undefined)
    )
  })
}

/**
 * Audit every record across every data file.
 *
 * `actions.json` holds most rules text, attributed back to its owner through
 * `actionSource`; a record's own fields are scanned too. The owning record is
 * what must carry the structured data, so a finding is reported against it.
 */
export function auditParity(filesByName: Record<string, Json[]>): ParityFinding[] {
  const findings: ParityFinding[] = []

  // name -> owning record, so an action's claim can be checked against the
  // entity that would have to encode it.
  const ownerByActionName = new Map<string, { record: Json; schema: string }>()
  for (const [schema, records] of Object.entries(filesByName)) {
    if (!PLAYER_CONTENT.has(schema)) continue
    for (const record of records) {
      const actions = record.actions
      if (!Array.isArray(actions)) continue
      for (const actionName of actions) {
        if (typeof actionName === 'string') {
          ownerByActionName.set(actionName, { record, schema })
        }
      }
    }
  }

  const seen = new Set<string>()

  const consider = (record: Json, schema: string, source: Json): void => {
    const name = typeof record.name === 'string' ? record.name : undefined
    if (!name) return
    const acc: string[] = []
    textOf(source.content ?? source.description ?? source.value ?? source, acc)
    for (const sentence of sentences(acc.join(' '))) {
      const klass = statesMechanicalChange(sentence)
      if (!klass) continue
      const key = `${name}::${klass}`
      if (seen.has(key)) continue
      seen.add(key)
      const exempt = PARITY_EXEMPTIONS[name]
      findings.push({
        record: name,
        schema,
        sentence: sentence.slice(0, 160),
        klass,
        encoded: klass === 'cap' ? hasCapData(record) : hasEffectData(record),
        ...(exempt ? { exempt } : {}),
      })
    }
  }

  for (const [schema, records] of Object.entries(filesByName)) {
    if (schema !== 'actions.json' && !PLAYER_CONTENT.has(schema)) continue
    for (const record of records) {
      if (schema === 'actions.json') {
        const actionName = typeof record.name === 'string' ? record.name : undefined
        const owner = actionName ? ownerByActionName.get(actionName) : undefined
        // An action with no PLAYER-content owner states rules for nothing the
        // app derives a number from (an NPC's attack, a table entry).
        if (owner && PLAYER_CONTENT.has(owner.schema)) consider(owner.record, owner.schema, record)
        continue
      }
      consider(record, schema, record)
    }
  }

  return findings
}

/** Findings that are neither encoded nor exempt — the remaining backlog. */
export function unresolvedFindings(findings: ParityFinding[]): ParityFinding[] {
  return findings.filter((f) => !f.encoded && !f.exempt)
}
