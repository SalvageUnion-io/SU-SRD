/**
 * Derived maxima for all three entities.
 *
 * "Many maxima are derived, not fixed" (rules digest): store modifiers,
 * compute totals. This module is the single source for those computations.
 *
 *   Pilot:   maxHP = 10 + 2×(crawler tech − 1) + maxHpModifier
 *                     − Σ(minor injury: 1, major: 2)
 *            maxAP = 5 + 1×(crawler tech − 1) + maxApModifier
 *   Mech:    max{SP,EP,Heat,Cargo} = chassis stat + max*Modifier
 *   Crawler: maxSP = tech-level structurePoints (ORM) + the chosen TYPE's
 *            `max_sp_bonus` mutations (Battle +5, applied at
 *            read) + maxSpModifier (a pure hand-edit)
 *
 * All functions are pure — no side effects, no async, no React. Parameter
 * types are small structural shapes (not full persisted records) — a
 * consumer's Zod-inferred Pilot/Mech/Crawler types (e.g. The Cantina's
 * `src/lib/schemas/`) satisfy them automatically.
 */
import type { ActiveEffects, ResolvedContribution } from './contributions';
/**
 * Base pilot stats per the core rules (10 HP / 5 AP / 6 inventory slots).
 * These are NOT in the reference data — class records do not encode them —
 * so they live here as the named baseline the derivations build on.
 */
export declare const PILOT_BASE_HP = 10;
export declare const PILOT_BASE_AP = 5;
export declare const PILOT_BASE_INVENTORY_SLOTS = 6;
/**
 * Resolve a stored POOL value — HP, SP, AP, EP — to what should be displayed
 * or acted on.
 *
 * The rule, stated once: **an unset pool means FULL**, and a stored value is
 * clamped to the current maximum. A fresh pilot has no `currentHP` because
 * nothing has damaged them yet, not because they are at zero; and a max that
 * has since dropped (an injury, a lost system) must not leave a stored value
 * above it.
 *
 * This existed as `Math.min(x.currentHP ?? maxHP, maxHP)` written out at ~40
 * call sites across the app and once more in the Discord bot, with no shared
 * definition anywhere. It is one keystroke wide: drop the `?? maxHP` and a
 * healthy pilot renders at 0 HP; the bot's own comment records the same worry
 * ("would render a fresh, undamaged crew as wiped out").
 *
 *
 * @param current - The stored value, or `undefined` if never set
 * @param max - The current derived maximum
 * @returns The value to show, in `[0, max]`
 */
export declare function resolvePool(current: number | undefined, max: number): number;
/**
 * The same "unset means FULL" default, WITHOUT the clamp — for the starting
 * value of a WRITE.
 *
 * Reach for this when the number is about to be spent from or damaged, rather
 * than shown. {@link resolvePool} clamps to `max`, which is right for display
 * and wrong here for one specific reason: `max` is derived, and a derivation
 * can legitimately come back 0 when its inputs do not resolve — an unresolvable
 * `chassisRef` makes `mechMaxEP` 0, and `MechSheet-unresolved-chassis` exists
 * because that state is real. Clamping at that moment would write the player's
 * EP or SP to zero as a side effect of a lookup failure.
 *
 * Displaying a stale over-max number is recoverable. Writing one away is not.
 *
 * @param current - The stored value, or `undefined` if never set
 * @param max - The current derived maximum, used only as the default
 * @returns The stored value, or `max` if it was never set
 */
export declare function resolvePoolStart(current: number | undefined, max: number): number;
/**
 * Resolve a stored GAUGE value — Heat — to what should be displayed or acted on.
 *
 * The mirror of {@link resolvePool}, and the reason both exist: Heat inverts
 * the default. **An unset gauge means EMPTY**, because a mech that has done
 * nothing is cold, not overheating. Getting this backwards puts a fresh mech at
 * its Heat Capacity, one roll from a Reactor Overload.
 *
 * That inversion was also hand-carried at every call site (`?? 0` rather than
 * `?? max`), which is exactly why it is worth naming: the two rules look alike
 * and mean opposite things.
 *
 * `max` is optional because a gauge is often read as the STARTING POINT for
 * arithmetic ("current heat, plus what this action costs") rather than for
 * display, and clamping before the addition would be wrong. Omit it to get the
 * default without a ceiling; pass it wherever the value is shown.
 *
 * @param current - The stored value, or `undefined` if never set
 * @param max - The current derived capacity, if the value is being displayed
 * @returns The value, in `[0, max]` when a max is given
 */
export declare function resolveGauge(current: number | undefined, max?: number): number;
/** A single pilot injury: minor −1 max HP, major −2. */
type Injury = {
    severity: 'minor' | 'major';
    note: string;
};
type PilotDerivationInput = {
    /** Ability refs the pilot holds — the source of ability contributions (ADR-029). */
    abilities?: string[];
    /**
     * The pilot's EFFECTIVE crawler Tech Level (1–6) — the source of the Stat
     * Training bonus (see `pilotStatTrainingContributions`). In the Cantina this is
     * `resolveEffectiveCrawlerLevel`: the linked crawler's tech level, else the
     * pilot's manual `crawlerLevel`. Absent = Tech 1 = no bonus.
     *
     * Deliberately NOT named `crawlerLevel`, which is a field on the Cantina's persisted
     * Pilot: passing a pilot record straight through would then silently pick up
     * the manual fallback and ignore a linked crawler. Callers set this explicitly.
     */
    crawlerTechLevel?: number;
    injuries?: Injury[];
    maxHpModifier?: number;
    maxApModifier?: number;
    maxInventorySlotsModifier?: number;
    maxHpOverride?: number;
    maxApOverride?: number;
    maxInventorySlotsOverride?: number;
};
/** Total max-HP penalty from injuries: minor −1, major −2. */
export declare function injuryMaxHpPenalty(injuries: Injury[] | undefined): number;
/**
 * Derived max HP. Can legitimately reach 0 or below — that is the dead state
 * ("if Max HP reaches 0 the Pilot dies") and is surfaced by
 * isPilotDead(), not clamped away here.
 */
export declare function pilotMaxHPParts(pilot: PilotDerivationInput): StatBreakdown;
export declare function pilotMaxHP(pilot: PilotDerivationInput): number;
/** Derived max AP: base 5 + Stat Training (crawler tier) + abilities + modifier. */
export declare function pilotMaxAPParts(pilot: PilotDerivationInput): StatBreakdown;
export declare function pilotMaxAP(pilot: PilotDerivationInput): number;
/**
 * Derived pilot inventory capacity (6 base) + the hand-edited
 * `maxInventorySlotsModifier` + ability contributions (Beefcake +4), with the
 * same absolute `maxInventorySlotsOverride` pin HP and AP already honour.
 *
 * This lived in the Cantina sheet as a bare number with no provenance and no
 * override path, which meant `maxInventorySlotsOverride` — a field that has been
 * in the Cantina's persisted Pilot schema all along — was read by nothing: a Free-Edit
 * pin wrote a value the gauge then ignored. Deriving it here, through the same
 * `breakdownOf` as every other maximum, is what makes the pin take effect and
 * gives the provenance panel a per-ability line instead of an anonymous total.
 */
export declare function pilotMaxInventorySlotsParts(pilot: PilotDerivationInput): StatBreakdown;
export declare function pilotMaxInventorySlots(pilot: PilotDerivationInput): number;
/** Dead-state check: derived max HP ≤ 0 means the pilot is dead. */
export declare function isPilotDead(pilot: PilotDerivationInput): boolean;
/** The chassis stats the mech derivations need (resolved from the ORM by ref). */
export type ChassisStats = {
    structurePoints?: number;
    energyPoints?: number;
    heatCapacity?: number;
    cargoCapacity?: number;
    /** Slot counts — read by `fromStat` contributions (Hull Magnetiser). */
    systemSlots?: number;
    moduleSlots?: number;
};
type MechDerivationInput = {
    chassisRef: string;
    maxSpModifier?: number;
    maxEpModifier?: number;
    maxHeatModifier?: number;
    maxCargoModifier?: number;
    maxSpOverride?: number;
    maxEpOverride?: number;
    maxHeatOverride?: number;
    maxCargoOverride?: number;
    systems?: string[];
    modules?: string[];
};
/**
 * The pilot whose abilities contribute to the mech they are piloting.
 *
 * Beefcake is a PILOT ability that raises the piloted MECH's Max SP and Cargo,
 * so a mech's maxima cannot be derived from the mech alone. Optional: a mech
 * with no pilot in scope simply gets no ability contributions, which is what an
 * unlinked mech should show.
 */
export type PilotingContext = {
    abilities?: string[];
    /** The mech's Tech Level, for `perTechLevel` amounts (Beefcake's 3+X). */
    techLevel?: number;
    /**
     * Which `duration: 'activated'` contributions are switched on right now.
     * Ephemeral play state, never persisted — an activated effect that is
     * off contributes nothing, exactly as if it were absent.
     */
    active?: ActiveEffects;
};
/**
 * How a derived maximum was arrived at (ADR-029).
 *
 * `derived` is what the rules produce: base + installed bonuses + the player's
 * manual adjustment, floored at 0. `override` is an absolute Free-Edit pin
 * (ADR-022 amendment); when it differs from the derived value it REPLACES it
 * rather than adding to it, and `derived` is retained so the sheet can render
 * an "overridden from N" callout and revert to it.
 *
 * `total` is what a surface should display.
 */
export type StatBreakdown = {
    /** The rules baseline before anything is added (chassis stat, tech-level SP, a constant). */
    base: number;
    /**
     * An ANONYMOUS rules-sourced addend — one aggregate line in the provenance
     * panel, with no per-item attribution. Two stats still use it: the pilot's
     * injury penalty (a negative contribution derived from `injuries`) and the
     * crawler's type `max_sp_bonus`. Installed systems/modules arrive through
     * `sources` instead, per item and by name ("Heat Sink +1").
     */
    installed: number;
    /**
     * Contributions that know their own source (ADR-029) — an ability, by name.
     * Rendered as one labelled line each, so "Beefcake +7" is never mislabelled as
     * installed hardware.
     */
    sources: ResolvedContribution[];
    /** The player's hand-entered manual adjustment (`max*Modifier`). Contributes; never replaces. */
    adjustment: number;
    /** base + installed + adjustment, floored at 0. Always computed, even when pinned. */
    derived: number;
    /** The absolute pin in effect — present exactly when `overridden` is. */
    override?: number;
    /** What to display: the pin when overridden, else `derived`. */
    total: number;
    /**
     * True when a stored pin differs from `derived` — THE override flag (ADR-022
     * amendment). Every override surface reads it and nothing re-derives it: the
     * override colour, the `*` marker, the ↺ revert, the "overridden from N"
     * caption and the ledger's Derived/Override lines. A gauge that compared two
     * numbers instead disagreed with the ledger on exactly the case below.
     *
     * A pin EQUAL to `derived` is not an override: it adds +0, so it is not a
     * modification ("If a bonus would provide +0, nullify it for the purposes of
     * modification"). That happens when upgrades catch up with a pin. The pin
     * stays stored — it is still the player's absolute pin, so a derivation that
     * later moves past it makes it a modification again, flagged and revertible —
     * but while it adds nothing it reads exactly like the derived value it equals.
     */
    overridden: boolean;
};
/**
 * What a Free-Edit write should store when the player types `next` as a
 * maximum: the pin, or `undefined` when `next` is what the rules already derive.
 *
 * The write-time half of the zero-delta rule `breakdownOf` applies at read time,
 * built on the same predicate so the two cannot drift: a pin equal to the
 * derivation is not an override, so it is never written — typing the derived
 * value back in is how a player deletes one.
 */
export declare function pinFor(next: number, parts: Pick<StatBreakdown, 'derived'>): number | undefined;
/**
 * Derived mech maxima: chassis stat + hand-edited modifier + every declared
 * `contribution` from the pilot's abilities and the mech's installed
 * systems/modules (heat sinks, capacitance banks, holds),
 * each counted per installed copy and attributed by name. Pass a pre-resolved
 * `chassis` to avoid repeated ORM lookups; floored at 0 so a negative total
 * never produces a negative maximum. `contributions` is the only numeric
 * encoding.
 */
export declare function mechMaxSPParts(mech: MechDerivationInput, chassis?: ChassisStats | null, pilot?: PilotingContext): StatBreakdown;
export declare function mechMaxEPParts(mech: MechDerivationInput, chassis?: ChassisStats | null, pilot?: PilotingContext): StatBreakdown;
export declare function mechMaxHeatParts(mech: MechDerivationInput, chassis?: ChassisStats | null, pilot?: PilotingContext): StatBreakdown;
export declare function mechMaxCargoParts(mech: MechDerivationInput, chassis?: ChassisStats | null, pilot?: PilotingContext): StatBreakdown;
export declare function mechMaxSP(mech: MechDerivationInput, chassis?: ChassisStats | null, pilot?: PilotingContext): number;
export declare function mechMaxEP(mech: MechDerivationInput, chassis?: ChassisStats | null, pilot?: PilotingContext): number;
export declare function mechMaxHeat(mech: MechDerivationInput, chassis?: ChassisStats | null, pilot?: PilotingContext): number;
export declare function mechMaxCargo(mech: MechDerivationInput, chassis?: ChassisStats | null, pilot?: PilotingContext): number;
/**
 * The unified read-time conditions vocabulary for a mech: the
 * free-form `conditions[]` merged with the automation-written boolean flags
 * (shutdown → 'Shutdown', vulnerable → 'Vulnerable', destroyed → 'Destroyed'),
 * deduplicated case-insensitively. Display layers render THIS list so the
 * two storage forms never disagree on screen.
 */
export declare function unifiedMechConditions(mech: {
    conditions: string[];
    shutdown?: boolean;
    vulnerable?: boolean;
    destroyed?: boolean;
}): string[];
type CrawlerDerivationInput = {
    techLevel: string;
    maxSpOverride?: number;
    /**
     * Chosen crawler-type slug — the type's stored
     * `max_sp_bonus` mutations (Battle +5) apply AT READ, so the record keeps
     * the BARE tech-level value and type swaps re-derive in both directions.
     * Absent/unresolvable = no type bonus.
     */
    type?: string;
    maxSpModifier?: number;
};
/**
 * Parse a crawler techLevel slug (e.g. "tech-3") to its numeric level (3).
 * Returns undefined when no digits are present.
 */
export declare function parseCrawlerTechLevel(techLevel: string): number | undefined;
/** The additive parts of a crawler's derived max SP (and their total). */
export type CrawlerMaxSPParts = StatBreakdown & {
    /**
     * The chosen type's `max_sp_bonus` mutations, applied at read (Battle +5).
     * A named alias for `installed` — this stat's only rules-sourced contribution
     * — kept because the wizard's SP breakdown copy reads it by name.
     */
    typeBonus: number;
};
/**
 * Derived crawler max SP, decomposed: the tech level's structurePoints from
 * the reference ORM, plus the chosen TYPE's stored `max_sp_bonus` mutations
 * applied AT READ (Battle Crawler +5 — the record stores the BARE tech-level
 * value, so type swaps re-derive correctly both ways), plus the hand-edited
 * maxSpModifier. Base resolves to 0 when the techLevel slug cannot be parsed
 * — the caller should surface that as a data problem rather than rendering a
 * silent 0-pip track.
 */
export declare function crawlerMaxSPParts(crawler: CrawlerDerivationInput): CrawlerMaxSPParts;
/** Derived crawler max SP — `crawlerMaxSPParts(crawler).total`. */
export declare function crawlerMaxSP(crawler: CrawlerDerivationInput): number;
export {};
