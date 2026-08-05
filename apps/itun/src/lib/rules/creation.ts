/**
 * Pilot + mech + crawler creation step gates (wizard-refresh Phases 3–5,
 * plan §5.1 app half).
 *
 * THIN ADAPTER only: destructures wizard form state into neutral inputs
 * (resolved reference records narrowed to primitives + counts) and calls the
 * package predicates in `salvageunion-reference/rules` — rule logic is never
 * duplicated here, so a SelCard's filter, the trackers' numbers, and the
 * Next gate can never drift apart.
 *
 * Pure TypeScript — no React. Requires `classes`/`abilities`/`equipment`
 * (pilot) and `chassis`/`systems`/`modules` (mech) preloaded (the wizard
 * route loaders already do).
 */

import type { SURefAbility, SURefClass, SURefEquipment, SURefSystem } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { CrawlerMutationInput, MechCreationBudget } from 'salvageunion-reference/rules'
import {
  computeMechCapacity,
  crawlerWeaponSlots,
  isCrawlerWeaponPickComplete,
  isLegalCreationAbility,
  isLegalCreationChassis,
  isLegalCreationClass,
  isLegalCreationCrawlerWeapon,
  isLegalCreationEquipment,
  isLegalCreationModule,
  isLegalCreationSystem,
  isPilotAbilityPickComplete,
  isPilotEquipmentPickComplete,
  isWeaponSystem,
  mechCreationBudget,
  PILOT_CREATION_ABILITY_PICKS,
  PILOT_CREATION_EQUIPMENT_PICKS,
  pilotEquipmentPicksRemaining,
  resolveChassisRef,
  resolveCrawlerRef,
  resolveModuleRef,
  resolveSystemRef,
} from 'salvageunion-reference/rules'
import type { CrawlerWizardFormState } from '../wizard/crawlerFormState'
import type { MechWizardFormState } from '../wizard/mechFormState'
import type { PilotWizardFormState } from '../wizard/pilotFormState'

/** Book-order pilot wizard step ids (Pilot Bay pp.18–19 + Review). */
export type PilotWizardStepId =
  | 'stats'
  | 'classAbility'
  | 'equipment'
  | 'callsign'
  | 'background'
  | 'motto'
  | 'keepsake'
  | 'appearance'
  | 'review'

/** Gate verdict: `reason` is the human footerNote text when blocked. */
export type StepGateResult = { ok: boolean; reason?: string }

const OK: StepGateResult = { ok: true }

function findClass(classId: string): SURefClass | undefined {
  if (!classId) return undefined
  return SalvageUnionReference.Classes.find((c) => c.id === classId)
}

/**
 * The class branch of the `SURefClass` union that actually carries `coreTrees`.
 * Reaching the field type through the schema-inferred type keeps the tree
 * NAMES a closed union (`z.array(TreeSchema)`, 36 literals) instead of
 * flattening them to `string` — a hand-typed tree name is then a compile
 * error here rather than a silently-empty ability list at runtime.
 */
type ClassCoreTrees = Extract<SURefClass, { coreTrees: unknown }>['coreTrees']

/**
 * The neutral input the package predicates read: a class's core ability trees,
 * or `undefined`. Narrowing the `SURefClass` union to `coreTrees` HERE (the
 * specialisation branch has no such property) keeps the package predicates
 * free of the union entirely. The predicates take the widened
 * `readonly string[]`, so the union survives this hop by covariance without
 * forcing the package to know about it.
 */
function coreTreesOf(cls: SURefClass | undefined): ClassCoreTrees | undefined {
  return cls && 'coreTrees' in cls ? cls.coreTrees : undefined
}

function findAbility(abilityId: string): SURefAbility | undefined {
  return SalvageUnionReference.Abilities.find((a) => a.id === abilityId)
}

function findEquipment(equipmentId: string): SURefEquipment | undefined {
  return SalvageUnionReference.Equipment.find((e) => e.id === equipmentId)
}

function classAbilityGate(form: PilotWizardFormState): StepGateResult {
  const coreTrees = coreTreesOf(findClass(form.classId))
  if (!isLegalCreationClass(coreTrees)) {
    return { ok: false, reason: 'Choose your class to continue' }
  }
  if (!isPilotAbilityPickComplete(form.abilities.length)) {
    return { ok: false, reason: 'Choose your first Ability to continue' }
  }
  const abilityId = form.abilities[0]
  const ability = abilityId === undefined ? undefined : findAbility(abilityId)
  if (!ability || !isLegalCreationAbility(ability, coreTrees)) {
    return { ok: false, reason: 'Choose your first Ability to continue' }
  }
  return OK
}

function equipmentGate(form: PilotWizardFormState): StepGateResult {
  const count = form.equipment.length
  if (isPilotEquipmentPickComplete(count)) {
    const allLegal = form.equipment.every((id) => {
      const item = findEquipment(id)
      return item !== undefined && isLegalCreationEquipment(item)
    })
    if (allLegal) return OK
    return { ok: false, reason: 'Only Tech 1 equipment is legal at creation' }
  }
  if (count > PILOT_CREATION_EQUIPMENT_PICKS) {
    const excess = count - PILOT_CREATION_EQUIPMENT_PICKS
    return {
      ok: false,
      reason: `Remove ${excess} equipment item${excess === 1 ? '' : 's'} to continue`,
    }
  }
  const remaining = pilotEquipmentPicksRemaining(count)
  return {
    ok: false,
    reason: `Choose ${remaining} more equipment item${remaining === 1 ? '' : 's'} to continue`,
  }
}

function callsignGate(form: PilotWizardFormState): StepGateResult {
  if (form.name.trim() === '' || form.callsign.trim() === '') {
    return { ok: false, reason: 'Enter a Name and Callsign to continue' }
  }
  return OK
}

/**
 * Next-gating for the pilot CREATE flow (guided mode is HARD — plan §5.3).
 * The wizard's `canAdvance()` is a call into this; the `reason` renders in
 * the WizShell footerNote beside the locked CTA.
 */
export function pilotCreationStepGate(
  step: PilotWizardStepId,
  form: PilotWizardFormState
): StepGateResult {
  switch (step) {
    case 'stats':
    case 'background':
    case 'motto':
    case 'keepsake':
    case 'appearance':
      return OK // display-only / optional flavor — Next always enabled
    case 'classAbility':
      return classAbilityGate(form)
    case 'equipment':
      return equipmentGate(form)
    case 'callsign':
      return callsignGate(form)
    case 'review': {
      // Everything re-checked; the first unmet gate names itself.
      for (const gate of [classAbilityGate, equipmentGate, callsignGate]) {
        const result = gate(form)
        if (!result.ok) return result
      }
      return OK
    }
  }
}

/** Result of a deterministic draft clamp: the healed form + what was dropped. */
export type PilotDraftClampResult = {
  form: PilotWizardFormState
  /** Human-readable names of everything removed (for the restore toast). */
  removed: string[]
}

function abilityName(id: string): string {
  return findAbility(id)?.name ?? id
}

function equipmentName(id: string): string {
  return findEquipment(id)?.name ?? id
}

/**
 * Deterministic clamp for a restored create-mode draft (plan §5.3): a draft
 * written before the hard-enforcement regime (or hand-edited) may violate the
 * creation rules. Violations resolve deterministically —
 *   - an illegal class (specialisation / unresolvable) is cleared along with
 *     every ability pick,
 *   - abilities illegal for the class are dropped, then excess picks are
 *     removed OLDEST-FIRST down to the 1-ability budget,
 *   - non-Tech-1 equipment is dropped, then excess removed OLDEST-FIRST down
 *     to the 2-item budget.
 * The caller shows one toast itemizing `removed`.
 */
export function clampPilotCreationDraft(form: PilotWizardFormState): PilotDraftClampResult {
  const removed: string[] = []
  let classId = form.classId
  let abilities = [...form.abilities]
  let equipment = [...form.equipment]

  if (classId !== '') {
    const cls = findClass(classId)
    const coreTrees = coreTreesOf(cls)
    if (!isLegalCreationClass(coreTrees)) {
      removed.push(cls?.name ?? 'class pick')
      removed.push(...abilities.map(abilityName))
      classId = ''
      abilities = []
    } else {
      const legal = abilities.filter((id) => {
        const ability = findAbility(id)
        return ability !== undefined && isLegalCreationAbility(ability, coreTrees)
      })
      removed.push(...abilities.filter((id) => !legal.includes(id)).map(abilityName))
      abilities = legal
    }
  } else if (abilities.length > 0) {
    removed.push(...abilities.map(abilityName))
    abilities = []
  }

  if (abilities.length > PILOT_CREATION_ABILITY_PICKS) {
    const excess = abilities.slice(0, abilities.length - PILOT_CREATION_ABILITY_PICKS)
    removed.push(...excess.map(abilityName))
    abilities = abilities.slice(abilities.length - PILOT_CREATION_ABILITY_PICKS)
  }

  const legalEquipment = equipment.filter((id) => {
    const item = findEquipment(id)
    return item !== undefined && isLegalCreationEquipment(item)
  })
  for (const id of equipment) {
    if (!legalEquipment.includes(id)) removed.push(equipmentName(id))
  }
  equipment = legalEquipment
  if (equipment.length > PILOT_CREATION_EQUIPMENT_PICKS) {
    const excess = equipment.slice(0, equipment.length - PILOT_CREATION_EQUIPMENT_PICKS)
    removed.push(...excess.map(equipmentName))
    equipment = equipment.slice(equipment.length - PILOT_CREATION_EQUIPMENT_PICKS)
  }

  if (removed.length === 0) return { form, removed }
  return { form: { ...form, classId, abilities, equipment }, removed }
}

// ---------------------------------------------------------------------------
// Mech Workshop (pp.94–95 — wizard-refresh Phase 4)
// ---------------------------------------------------------------------------

/** Book-order mech wizard step ids (Mech Workshop pp.94–95 + Review). */
export type MechWizardStepId =
  | 'scrap'
  | 'chassis'
  | 'stats'
  | 'systems'
  | 'modules'
  | 'quirk'
  | 'appearance'
  | 'pattern'
  | 'review'

function chassisSVOf(chassisRef: string): number {
  if (!chassisRef) return 0
  return resolveChassisRef(chassisRef)?.salvageValue ?? 0
}

/**
 * The 20-Scrap creation budget for the live form (plan §4.2 step 1): the
 * chassis + every installed copy resolved to their Salvage Values (the
 * primitives the package calculator reads). Unresolvable refs price at 0 —
 * they can't be costed, and the TL-legality gates catch them separately.
 */
export function mechCreationBudgetFor(form: MechWizardFormState): MechCreationBudget {
  const counts = new Map<string, number>()
  for (const ref of [...form.systems, ...form.modules]) {
    counts.set(ref, (counts.get(ref) ?? 0) + 1)
  }
  const loadout = [...counts.entries()].map(([ref, count]) => {
    const item = resolveSystemRef(ref) ?? resolveModuleRef(ref)
    return { sv: item?.salvageValue ?? 0, count }
  })
  return mechCreationBudget({ chassisSV: chassisSVOf(form.chassisName), loadout })
}

function mechChassisGate(form: MechWizardFormState): StepGateResult {
  const chassis = form.chassisName ? resolveChassisRef(form.chassisName) : null
  if (!chassis || !isLegalCreationChassis(chassis.techLevel)) {
    return { ok: false, reason: 'Craft your Chassis to continue' }
  }
  return OK
}

function mechNameGate(form: MechWizardFormState): StepGateResult {
  if (form.name.trim() === '') {
    return { ok: false, reason: 'Name your Pattern to continue' }
  }
  return OK
}

/** Every installed item must be a resolvable Tech 1 system/module. */
function mechLoadoutLegalityGate(form: MechWizardFormState): StepGateResult {
  const systemsLegal = form.systems.every((ref) => {
    const item = resolveSystemRef(ref)
    return item !== null && isLegalCreationSystem(item.techLevel)
  })
  const modulesLegal = form.modules.every((ref) => {
    const item = resolveModuleRef(ref)
    return item !== null && isLegalCreationModule(item.techLevel)
  })
  if (!systemsLegal || !modulesLegal) {
    return { ok: false, reason: 'Only Tech 1 Systems and Modules are legal at creation' }
  }
  return OK
}

/** The 20-Scrap cap and both slot budgets must hold (belt for the Review). */
function mechBudgetGate(form: MechWizardFormState): StepGateResult {
  if (mechCreationBudgetFor(form).remaining < 0) {
    return { ok: false, reason: 'Over the 20 Tech 1 Scrap budget — remove items' }
  }
  const capacity = computeMechCapacity({
    chassisRef: form.chassisName,
    systems: form.systems.map((ref) => ({ ref })),
    modules: form.modules.map((ref) => ({ ref })),
  })
  if (capacity.violations.some((v) => v.kind === 'system-over-slots')) {
    return { ok: false, reason: 'Over System Slot capacity — remove Systems' }
  }
  if (capacity.violations.some((v) => v.kind === 'module-over-slots')) {
    return { ok: false, reason: 'Over Module Slot capacity — remove Modules' }
  }
  return OK
}

/**
 * Next-gating for the mech CREATE flow (guided mode is HARD — plan §5.3).
 * Briefing/derived steps (scrap, stats) and the optional crafting + flavor
 * steps never block; the chassis and the pattern name are required; Review
 * re-checks everything including the 20-Scrap and slot invariants (which are
 * satisfied by construction in the guided UI — this is the backstop that
 * makes the invariant a guarantee, not a hope).
 */
export function mechCreationStepGate(
  step: MechWizardStepId,
  form: MechWizardFormState
): StepGateResult {
  switch (step) {
    case 'scrap':
    case 'stats':
    case 'systems':
    case 'modules':
    case 'quirk':
    case 'appearance':
      return OK // briefing / display-only / optional — Next always enabled
    case 'chassis':
      return mechChassisGate(form)
    case 'pattern':
      return mechNameGate(form)
    case 'review': {
      for (const gate of [mechChassisGate, mechNameGate, mechLoadoutLegalityGate, mechBudgetGate]) {
        const result = gate(form)
        if (!result.ok) return result
      }
      return OK
    }
  }
}

/** Result of the deterministic mech draft clamp (plan §5.3). */
export type MechDraftClampResult = {
  form: MechWizardFormState
  /** Human-readable names of everything removed (for the restore toast). */
  removed: string[]
}

function installedName(ref: string): string {
  return (resolveSystemRef(ref) ?? resolveModuleRef(ref))?.name ?? ref
}

/** Which creation budgets a draft loadout currently violates. */
type BudgetViolations = {
  scrap: boolean
  systemSlots: boolean
  moduleSlots: boolean
}

function budgetViolationsOf(form: MechWizardFormState): BudgetViolations {
  const capacity = computeMechCapacity({
    chassisRef: form.chassisName,
    systems: form.systems.map((ref) => ({ ref })),
    modules: form.modules.map((ref) => ({ ref })),
  })
  return {
    scrap: mechCreationBudgetFor(form).remaining < 0,
    systemSlots: capacity.violations.some((v) => v.kind === 'system-over-slots'),
    moduleSlots: capacity.violations.some((v) => v.kind === 'module-over-slots'),
  }
}

/**
 * Deterministic clamp for a restored mech create-mode draft (plan §5.3 —
 * KNAPSACK, not truncation): a draft written before the hard-enforcement
 * regime may violate the creation rules. Resolution order:
 *   - an illegal chassis (non-Tech-1 / unresolvable) is cleared along with
 *     the pattern and the whole loadout (nothing can be costed without it),
 *   - otherwise chassis + pattern are ALWAYS preserved,
 *   - non-Tech-1 / unresolvable systems and modules are dropped,
 *   - then the loadout is walked decrementing per-item copies NEWEST-first,
 *     each iteration popping from a pool that can ACTUALLY RELIEVE the
 *     violated budget: modules when module-slots overflow, systems when
 *     system-slots overflow (Mazona reaches this — 7 system slots), else
 *     (pure scrap overspend) modules-newest-first then systems. So a
 *     system-slots-only violation never uselessly discards legal modules,
 *     and the toast attributes exactly what it removed,
 *   - starting cargo is cleared (the rules grant a new mech no cargo; the
 *     input left guided create in Phase 4).
 * The caller shows one toast itemizing `removed`.
 */
export function clampMechCreationDraft(form: MechWizardFormState): MechDraftClampResult {
  const removed: string[] = []
  let chassisName = form.chassisName
  let patternName = form.patternName
  let systems = [...form.systems]
  let modules = [...form.modules]
  let cargoLots = form.cargoLots

  if (chassisName !== '') {
    const chassis = resolveChassisRef(chassisName)
    if (!chassis || !isLegalCreationChassis(chassis.techLevel)) {
      removed.push(chassis?.name ?? chassisName)
      removed.push(...systems.map(installedName), ...modules.map(installedName))
      chassisName = ''
      patternName = ''
      systems = []
      modules = []
    }
  } else if (systems.length > 0 || modules.length > 0) {
    removed.push(...systems.map(installedName), ...modules.map(installedName))
    systems = []
    modules = []
  }

  const legalSystems = systems.filter((ref) => {
    const item = resolveSystemRef(ref)
    return item !== null && isLegalCreationSystem(item.techLevel)
  })
  removed.push(...systems.filter((ref) => !legalSystems.includes(ref)).map(installedName))
  systems = legalSystems

  const legalModules = modules.filter((ref) => {
    const item = resolveModuleRef(ref)
    return item !== null && isLegalCreationModule(item.techLevel)
  })
  removed.push(...modules.filter((ref) => !legalModules.includes(ref)).map(installedName))
  modules = legalModules

  // Knapsack walk: each iteration drops the NEWEST copy from a pool that can
  // relieve the specific violated budget — never a pool that can't help.
  // Chassis + pattern are never touched here.
  for (;;) {
    const violations = budgetViolationsOf({ ...form, chassisName, systems, modules, cargoLots: [] })
    if (!violations.scrap && !violations.systemSlots && !violations.moduleSlots) break

    let dropped: string | undefined
    if (violations.moduleSlots && modules.length > 0) {
      dropped = modules.pop()
    } else if (violations.systemSlots && systems.length > 0) {
      dropped = systems.pop()
    } else {
      // Pure scrap overspend (or a slot pool that is already empty): drop the
      // newest copy overall — modules (the later step) before systems.
      dropped = modules.length > 0 ? modules.pop() : systems.pop()
    }
    if (dropped === undefined) break // nothing left to drop; chassis alone fits by data
    removed.push(installedName(dropped))
  }

  if (cargoLots.length > 0) {
    removed.push('starting cargo')
    cargoLots = []
  }

  if (removed.length === 0) return { form, removed }
  return { form: { ...form, chassisName, patternName, systems, modules, cargoLots }, removed }
}

// ---------------------------------------------------------------------------
// Union Crawler (pp.212–213 — wizard-refresh Phase 5)
// ---------------------------------------------------------------------------

/** Book-order crawler wizard step ids (Union Crawler pp.212–213 + Review). */
export type CrawlerWizardStepId = 'type' | 'stats' | 'weapons' | 'crew' | 'identity' | 'review'

/**
 * Narrow a stored crawler-type ref (SRD id OR name, the bay-ref tolerance) to
 * the neutral `mutations` rows the package calculators read. Null/unknown
 * refs narrow to `undefined` — no mutations, the base rules.
 */
function crawlerTypeMutationsOf(
  typeRef: string | null
): readonly CrawlerMutationInput[] | undefined {
  if (typeRef === null || typeRef === '') return undefined
  const type = resolveCrawlerRef(typeRef)
  return type?.mutations
}

/**
 * Armament-Bay weapon slots for the chosen type — read from the type's STORED
 * `mutations` field via the package calculator (Battle = 2), never an
 * action-name string match. The same number drives the SelCard cap, the
 * WEAPONS tracker, the re-clamp on a type change, and the Review gate.
 */
export function crawlerWeaponSlotsFor(typeRef: string | null): number {
  return crawlerWeaponSlots(crawlerTypeMutationsOf(typeRef))
}

function findCrawlerWeapon(ref: string): SURefSystem | null {
  return resolveSystemRef(ref)
}

/** A creation-legal Armament-Bay mount: a resolvable Tech 1 WEAPONS system. */
function isLegalCrawlerWeaponRef(ref: string): boolean {
  const system = findCrawlerWeapon(ref)
  return system !== null && isWeaponSystem(system) && isLegalCreationCrawlerWeapon(system.techLevel)
}

/** Resolve a stored crawler-type ref (id or name) against the SRD catalog. */
function crawlerTypeResolves(typeRef: string | null): boolean {
  if (typeRef === null || typeRef === '') return false
  return resolveCrawlerRef(typeRef) !== null
}

function crawlerTypeGate(form: CrawlerWizardFormState): StepGateResult {
  if (!crawlerTypeResolves(form.type)) {
    return { ok: false, reason: 'Choose your Crawler type to continue' }
  }
  return OK
}

function crawlerWeaponsGate(form: CrawlerWizardFormState): StepGateResult {
  if (!isCrawlerWeaponPickComplete(form.systems.length)) {
    return { ok: false, reason: 'Mount at least one Weapons System to continue' }
  }
  if (!form.systems.every(isLegalCrawlerWeaponRef)) {
    return { ok: false, reason: 'Only Tech 1 Weapons Systems are legal at creation' }
  }
  const slots = crawlerWeaponSlotsFor(form.type)
  if (form.systems.length > slots) {
    const excess = form.systems.length - slots
    return {
      ok: false,
      reason: `Remove ${excess} Weapons System${excess === 1 ? '' : 's'} — this type mounts ${slots}`,
    }
  }
  return OK
}

function crawlerNameGate(form: CrawlerWizardFormState): StepGateResult {
  if (form.name.trim() === '') {
    return { ok: false, reason: 'Name your Crawler to continue' }
  }
  return OK
}

/**
 * Next-gating for the crawler CREATE flow (guided mode is HARD — plan §5.3).
 * The Statistics briefing and the optional Crew step never block; the type
 * pick, the minimum-1 Tech-1 weapon mount (capped at the type's slots), and
 * the name are required; Review re-checks everything.
 */
export function crawlerCreationStepGate(
  step: CrawlerWizardStepId,
  form: CrawlerWizardFormState
): StepGateResult {
  switch (step) {
    case 'stats':
    case 'crew':
      return OK // display-only / optional flavor — Next always enabled
    case 'type':
      return crawlerTypeGate(form)
    case 'weapons':
      return crawlerWeaponsGate(form)
    case 'identity':
      return crawlerNameGate(form)
    case 'review': {
      for (const gate of [crawlerTypeGate, crawlerWeaponsGate, crawlerNameGate]) {
        const result = gate(form)
        if (!result.ok) return result
      }
      return OK
    }
  }
}

/** Result of the deterministic crawler draft clamp (plan §5.3). */
export type CrawlerDraftClampResult = {
  form: CrawlerWizardFormState
  /** Human-readable names of everything removed (for the restore toast). */
  removed: string[]
}

function crawlerWeaponName(ref: string): string {
  return findCrawlerWeapon(ref)?.name ?? ref
}

/**
 * Deterministic clamp for a restored crawler create-mode draft (plan §5.3):
 * a draft written before the hard-enforcement regime may violate the creation
 * rules. Resolution order —
 *   - an unresolvable type ref is cleared (its crew entry with it),
 *   - non-weapon / non-Tech-1 / unresolvable systems are dropped,
 *   - then the weapons are clamped NEWEST-first down to the type's
 *     Armament-Bay slots (mutations-derived; 1, Battle 2).
 * The caller shows one toast itemizing `removed`.
 */
export function clampCrawlerCreationDraft(form: CrawlerWizardFormState): CrawlerDraftClampResult {
  const removed: string[] = []
  let type = form.type
  let crew = form.crew
  let systems = [...form.systems]

  if (type !== null && !crawlerTypeResolves(type)) {
    removed.push(`type pick (${type})`)
    crew = { ...crew }
    delete crew[type]
    type = null
  }

  const legal = systems.filter(isLegalCrawlerWeaponRef)
  removed.push(...systems.filter((ref) => !legal.includes(ref)).map(crawlerWeaponName))
  systems = legal

  const slots = crawlerWeaponSlotsFor(type)
  while (systems.length > slots) {
    const dropped = systems.pop()
    if (dropped === undefined) break
    removed.push(crawlerWeaponName(dropped))
  }

  if (removed.length === 0) return { form, removed }
  return { form: { ...form, type, crew, systems }, removed }
}
