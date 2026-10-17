/**
 * Union Crawler Downtime Procedure.
 *
 * Salvage Union Core Book p.227-228 — the per-session bookkeeping loop that
 * today costs ~8 manual edits across three sheets. Rules summary:
 *
 * - "Restore your Mech & Pilot" (p.228): a mech's SP and Energy fully restore
 *   and its Heat drops to 0. Damaged Mech Chassis, Systems and Modules are
 *   repaired to Intact as long as their Tech Level is ≤ the Crawler's
 *   (Destroyed items are never repaired — they are salvage).
 * - Mech Bay (p.221): restore and repair happen IN the Mech Bay. "If the
 *   Mech Bay becomes damaged, your Mechs can no longer restore SP and EP
 *   during Downtime. Their Chassis as well as any Systems or Modules will
 *   not be repaired if they are damaged." Mirrors the Med Bay gate below.
 * - Med Bay (p.223): Tech 1-2 heals a pilot to full HP; Tech 3-4 also heals
 *   Minor Injuries; Tech 5-6 also heals Major Injuries. "If the Med Bay is
 *   damaged, you cannot heal any of your Pilot's Hit Points or injuries."
 *   AP restores through Downtime rest regardless (the damage clause blocks
 *   only HP + injuries).
 * - "Train your Pilot" (p.228): +1 Training Point per pilot per Downtime.
 * - Uses (X) counters recharge after Downtime. The Orbital
 *   Lance Controller explicitly never regains uses — it stays hand-managed.
 * - Once-per-Downtime bookkeeping resets: used pilot abilities and the
 *   Background/Keepsake/Motto 'Used' toggles.
 * - Upkeep (p.227): 5 Scrap of the crawler's Tech Level per
 *   Downtime. Paying it is a separate economy action (a later package) —
 *   this module only names the cost for the prompt.
 *
 * This module is PURE (no React, no store, no randomness): it computes
 * per-entity patches the caller applies through the entity store. Per ADR-007 every step is
 * individually skippable — the runner dialog shows what will be applied and
 * the player deselects anything the table rules differently.
 */
import type { Crawler } from '../schemas/crawler';
import type { Mech } from '../schemas/mech';
import type { Pilot } from '../schemas/pilot';
/** The skippable Downtime steps, in rules order (p.227-228). */
export declare const DOWNTIME_STEP_KEYS: readonly ['restoreMechs', 'repairItems', 'healPilots', 'healInjuries', 'trainPilots', 'rechargeUses', 'clearUsed'];
export type DowntimeStepKey = (typeof DOWNTIME_STEP_KEYS)[number];
/** Which steps the player left enabled (ADR-007: every step skippable). */
export type DowntimeSteps = Record<DowntimeStepKey, boolean>;
/** All steps enabled — the dialog's starting state. */
export declare function allDowntimeSteps(): DowntimeSteps;
/** Upkeep cost: 5 Scrap of the crawler's Tech Level per Downtime. */
export declare const DOWNTIME_UPKEEP_SCRAP = 5;
/**
 * The Crawler Downtime step Upkeep belongs to (p.227). Inside a Game's
 * Downtime, Upkeep is paid in this step and no other; the crawler sheet stays
 * editable at any time.
 */
export declare const UPKEEP_STEP_NAME = "Upkeep & Upgrade";
/** The Crawler Downtime guide's steps, in order; empty when the guide is missing. */
export declare function downtimeGuideSteps(): {
    id: string;
    name: string;
    section?: string | undefined;
    content?: {
        type: "choice" | "datavalues" | "flavor" | "heading" | "hint" | "label" | "list-item" | "paragraph";
        value?: string | {
            label: string | number;
            value?: string | number | undefined;
            type?: "cost" | "keyword" | "trait" | undefined;
            unit?: string | undefined;
            perTechLevel?: number | undefined;
        }[] | undefined;
        label?: string | undefined;
        level?: number | undefined;
        lead?: boolean | undefined;
        choiceId?: string | undefined;
        items?: {
            type: "choice" | "datavalues" | "flavor" | "heading" | "hint" | "label" | "list-item" | "paragraph";
            value?: string | {
                label: string | number;
                value?: string | number | undefined;
                type?: "cost" | "keyword" | "trait" | undefined;
                unit?: string | undefined;
                perTechLevel?: number | undefined;
            }[] | undefined;
            label?: string | undefined;
            level?: number | undefined;
        }[] | undefined;
    }[] | undefined;
    schema?: ("abilities" | "ability-tree-requirements" | "actions" | "bio-titans" | "chassis" | "classes" | "crawler-bays" | "crawler-tech-levels" | "crawlers" | "creatures" | "distances" | "drones" | "equipment" | "factions" | "guides" | "keywords" | "meld" | "modules" | "npcs" | "roll-tables" | "sources" | "squads" | "systems" | "tech-levels" | "traits" | "vehicles")[] | undefined;
    schemaEntities?: string[] | undefined;
    schemaField?: string | undefined;
    rollTable?: string | undefined;
    choiceOptions?: {
        label: string;
        value: string;
        description?: string | undefined;
        effects?: ({
            op: "addTrait";
            value: string;
            amount?: string | number | undefined;
            target?: "hostMech" | "self" | undefined;
        } | {
            op: "removeTrait";
            value: string;
            target?: "hostMech" | "self" | undefined;
        } | {
            op: "setRange";
            value: string | number;
        } | {
            op: "addDamage";
            value: string | number;
            unit?: string | undefined;
        })[] | undefined;
    }[] | undefined;
    filters?: {
        field: string;
        operator?: "eq" | "ne" | undefined;
        value?: string | number | boolean | undefined;
        min?: number | undefined;
        max?: number | undefined;
    }[] | undefined;
    constraints?: {
        field?: string | undefined;
        min?: number | undefined;
        max?: number | undefined;
        scalesWithField?: string | undefined;
    } | undefined;
    guideRef?: string | undefined;
    optional?: boolean | undefined;
    paperOnly?: boolean | undefined;
    entityLayout?: "sidebar" | undefined;
}[];
/** How many steps the Downtime procedure has (the reference guide's). */
export declare function downtimeStepCount(): number;
/**
 * The Downtime steps' names, in order (Workshop Manual p.227–228): "Tally
 * Salvage" … "Prepare for the next Salvage Run". The Mediator's step track
 * draws these, so it shows the guide's ten rather than a board's five.
 */
export declare function downtimeStepNames(): string[];
/**
 * Whether the Downtime step at `stepIndex` is the Upkeep step, read from the
 * Crawler Downtime guide (the same steps `DowntimeWizard` renders). False when
 * Downtime is not running.
 */
export declare function isUpkeepStep(stepIndex: number | null): boolean;
export type MedBayStatus = {
    /** A Med Bay is installed on the crawler. */
    present: boolean;
    /** The installed Med Bay is currently Damaged. */
    damaged: boolean;
    /** present && !damaged — HP and injuries can heal at all. */
    operational: boolean;
    /** operational && crawler Tech 3+ — Minor Injuries heal. */
    healsMinor: boolean;
    /** operational && crawler Tech 5+ — Major Injuries heal. */
    healsMajor: boolean;
};
/**
 * The crawler's Med Bay capability this Downtime: presence + Damaged state of
 * the installed bay, banded by the crawler's Tech Level (Tech 1-2 HP only,
 * Tech 3-4 + Minor, Tech 5-6 + Major — p.223). No Med Bay, or a Damaged one,
 * blocks HP and injury healing entirely.
 */
export declare function medBayStatus(crawler: Pick<Crawler, 'crawlerBays' | 'techLevel'>): MedBayStatus;
export type MechBayStatus = {
    /** A Mech Bay is installed on the crawler. */
    present: boolean;
    /** The installed Mech Bay is currently Damaged. */
    damaged: boolean;
    /** present && !damaged — SP/EP/Heat restore and Downtime repairs can run. */
    operational: boolean;
};
/**
 * The crawler's Mech Bay capability this Downtime. Every Union Crawler has a
 * Mech Bay at the crawler's own Tech Level (p.240), but a Damaged one blocks
 * SP/EP restoration and all Downtime repairs (p.221) — and a missing entry
 * (data drift) is reported so the runner can surface it instead of silently
 * restoring anyway.
 */
export declare function mechBayStatus(crawler: Pick<Crawler, 'crawlerBays'>): MechBayStatus;
/** The 'Chassis Damaged' condition label written by the Critical Damage flow. */
export declare const CHASSIS_DAMAGED_CONDITION = "Chassis Damaged";
export type RepairableItems = {
    /** Damaged system/module refs the Downtime repair flips to Intact. */
    repairable: string[];
    /** Damaged refs that stay Damaged: Tech Level above the crawler's, or unresolvable. */
    blocked: string[];
    /** The 'Chassis Damaged' condition clears (chassis TL ≤ crawler TL). */
    chassisRepairable: boolean;
};
/**
 * Which of the mech's Damaged items this Downtime repairs: systems/modules
 * (and the chassis' 'Chassis Damaged' condition) with a Tech Level ≤ the
 * crawler's flip to Intact (p.228). Destroyed items are never repaired;
 * unresolvable refs (custom items) are left alone and reported as blocked.
 */
export declare function repairableItems(mech: Pick<Mech, 'systemConditions' | 'moduleConditions' | 'conditions' | 'chassisRef'>, crawlerTl: number): RepairableItems;
/**
 * The Downtime patch for one mech. Only fields that actually change are
 * included — an empty patch means "skip the write". A Destroyed mech is
 * skipped entirely: Downtime repairs Damaged, never resurrects Destroyed
 * (build a new mech in the Crafting Bay instead).
 *
 * `mechBay` gates restore + repair (p.221: a Damaged — or missing — Mech Bay
 * blocks both; Uses still recharge, that is Downtime rest, not the bay).
 * Omitted = assume operational, for callers outside the crawler context.
 */
export declare function downtimeMechPatch(mech: Mech, crawlerTl: number, steps: DowntimeSteps, mechBay?: Pick<MechBayStatus, 'operational'>): Partial<Mech>;
/**
 * Equipment that never regains Uses at Downtime (hand-managed): the Orbital
 * Lance Controller's satellite only ever holds three strikes.
 */
export declare const NEVER_RECHARGE_EQUIPMENT: readonly ['orbital-lance-controller'];
/**
 * The Downtime patch for one pilot. Only fields that actually change are
 * included — an empty patch means "skip the write".
 *
 * Ordering matters: injuries heal FIRST, then HP restores to the max derived
 * from the injuries that remain — healing a Minor Injury at a Tech 3 Med Bay
 * restores the pilot to the recovered maximum in one pass.
 *
 * `crawlerTechLevel` is the pilot's effective crawler tier
 * (`resolveEffectiveCrawlerLevel`) — it raises max HP/AP via Stat Training, so
 * rest restores to the same maximum the sheet shows. Absent = Tech 1.
 */
export declare function downtimePilotPatch(pilot: Pilot, medBay: MedBayStatus, steps: DowntimeSteps, crawlerTechLevel?: number): Partial<Pilot>;
