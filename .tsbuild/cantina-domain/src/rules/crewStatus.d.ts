import type { Crawler } from '../schemas/crawler';
import type { Mech } from '../schemas/mech';
import type { Pilot } from '../schemas/pilot';
/**
 * A crewmate's derived maxima and status, computed one way for every surface
 * (ADR-038 §4).
 *
 * The server serves these to the whole crew (`crew.vitals`, read by the Crew
 * tab), and the Dashboard's own slots read the same maxima (`slots.model.ts`),
 * so the ▲ on the Crew tab, a crewmate's row and the player's own Minor agree.
 * `test/convex/__tests__/crewStatus.test.ts` holds the two sides to it on shared
 * fixtures.
 *
 * Pure. It reads the abilities, chassis, systems and modules schemas, so they
 * must be loaded first: `preload` in the browser, `loadReferenceData()`
 * (`convex/model/referenceData.ts`) on the server.
 */
/**
 * A pilot's max HP and AP. The crawler they crew (`pilot-to-crawler`) sets
 * the Stat Training bonus; with none, the pilot's own `crawlerLevel` does.
 */
export declare function pilotMaxima(pilot: Pilot, crawler: Pick<Crawler, 'techLevel'> | null): {
    statInput: {
        gameId?: string | null | undefined;
        photo?: {
            kind: "upload";
            storageId: string;
            url: string;
        } | {
            kind: "asset";
            path: string;
        } | undefined;
        id: string;
        schemaVersion: 1;
        name: string;
        callsign: string;
        pronouns?: string | undefined;
        classRef: string;
        originClassRef?: string | undefined;
        abilities: string[];
        equipment: string[];
        motto: string;
        keepsake: string;
        appearance: string;
        background: string;
        description?: string | undefined;
        conditions: string[];
        seedRef?: string | undefined;
        currentHP?: number | undefined;
        currentAP?: number | undefined;
        equipmentConditions?: Record<string, "damaged" | "destroyed" | "intact"> | undefined;
        equipmentChoices?: Record<string, Record<string, string[]>> | undefined;
        partners?: {
            id: string;
            hostRef: string;
            hostSchema: "drones" | "equipment";
            name?: string | undefined;
            appearance?: string | undefined;
            aiPersonality?: string | undefined;
            techLevelOverride?: number | undefined;
            currentSP?: number | undefined;
            currentEP?: number | undefined;
            currentHeat?: number | undefined;
            systems: string[];
            modules: string[];
            systemConditions?: Record<string, "damaged" | "destroyed" | "intact"> | undefined;
            moduleConditions?: Record<string, "damaged" | "destroyed" | "intact"> | undefined;
            itemUses?: Record<string, number> | undefined;
            conditions: string[];
            cargoLots?: {
                id: string;
                kind: "bulk" | "unit";
                name: string;
                cat: "POWER" | "SCRAP" | "SEALED" | "SYSTEM";
                tl?: number | undefined;
                qty?: number | undefined;
                units: number;
                code: string;
            }[] | undefined;
        }[] | undefined;
        crawlerLevel?: number | undefined;
        usedAbilities?: string[] | undefined;
        trainingPoints?: number | undefined;
        injuries?: {
            severity: "major" | "minor";
            note: string;
        }[] | undefined;
        maxHpModifier?: number | undefined;
        maxApModifier?: number | undefined;
        maxInventorySlotsModifier?: number | undefined;
        maxHpOverride?: number | undefined;
        maxApOverride?: number | undefined;
        maxInventorySlotsOverride?: number | undefined;
        equipmentUses?: Record<string, number> | undefined;
        usedToggles?: {
            background?: boolean | undefined;
            keepsake?: boolean | undefined;
            motto?: boolean | undefined;
        } | undefined;
        genericInventory?: {
            id: string;
            name: string;
            slotCost: number;
            qty?: number | undefined;
            note?: string | undefined;
        }[] | undefined;
        lastCriticalInjury?: {
            roll: number;
            outcome: "fatal" | "major-injury" | "minor-injury" | "miraculous-survival" | "unconscious";
            rolledAt: string;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        crawlerTechLevel: number | undefined;
    };
    hpParts: import("salvageunion-reference/rules").StatBreakdown;
    apParts: import("salvageunion-reference/rules").StatBreakdown;
    maxHP: number;
    maxAP: number;
};
/**
 * A mech's max SP, EP and Heat. Beefcake is a PILOT ability that raises the
 * piloted MECH (ADR-029), so the pilot in it (or assigned to it) and the
 * effects their seat has switched on come in too.
 */
export declare function mechMaxima(mech: Mech, pilotAbilities: string[] | undefined, switchedOn: readonly string[]): {
    chassis: ({
        structurePoints: number;
        energyPoints: number;
        heatCapacity: number;
        systemSlots: number;
        moduleSlots: number;
        cargoCapacity: number;
        techLevel: number | "B" | "N";
        salvageValue: number;
        hasArtwork?: boolean | undefined;
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
        id: string;
        blackMarket?: boolean | undefined;
        name: string;
        source: "False Flag" | "Mech Monday" | "Rainmaker" | "Reclamation of the Wastes" | "Relics of a Time Gone By" | "Salvage Union Starter Set" | "Salvage Union Workshop Manual" | "Thatcher's Mech Base" | "The Hive" | "We Were Here First!";
        page: number;
        booklet?: string | undefined;
        additionalSources?: {
            source: "False Flag" | "Mech Monday" | "Rainmaker" | "Reclamation of the Wastes" | "Relics of a Time Gone By" | "Salvage Union Starter Set" | "Salvage Union Workshop Manual" | "Thatcher's Mech Base" | "The Hive" | "We Were Here First!";
            booklet?: string | undefined;
            page: number;
        }[] | undefined;
        chassisAbilities: string[];
        heads?: {
            structurePoints: number;
            energyPoints: number;
            heatCapacity: number;
            systemSlots: number;
            moduleSlots: number;
            cargoCapacity: number;
            techLevel: number | "B" | "N";
            salvageValue: number;
            name: string;
        }[] | undefined;
        patterns: {
            name: string;
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
            legalStarting?: boolean | undefined;
            hidden?: boolean | undefined;
            homebrew?: boolean | undefined;
            source?: "False Flag" | "Mech Monday" | "Rainmaker" | "Reclamation of the Wastes" | "Relics of a Time Gone By" | "Salvage Union Starter Set" | "Salvage Union Workshop Manual" | "Thatcher's Mech Base" | "The Hive" | "We Were Here First!" | undefined;
            page?: number | undefined;
            booklet?: string | undefined;
            additionalSources?: {
                source: "False Flag" | "Mech Monday" | "Rainmaker" | "Reclamation of the Wastes" | "Relics of a Time Gone By" | "Salvage Union Starter Set" | "Salvage Union Workshop Manual" | "Thatcher's Mech Base" | "The Hive" | "We Were Here First!";
                booklet?: string | undefined;
                page: number;
            }[] | undefined;
            systems: {
                name: string;
                count?: number | undefined;
                preselectedChoices?: Record<string, string> | undefined;
                head?: string | undefined;
            }[];
            modules: {
                name: string;
                count?: number | undefined;
                preselectedChoices?: Record<string, string> | undefined;
                head?: string | undefined;
            }[];
            drones?: {
                name: string;
                ref?: string | undefined;
                systems: string[];
                modules: string[];
            }[] | undefined;
        }[];
    } & {
        schemaName: string;
    }) | null;
    active: {
        [k: string]: boolean;
    };
    piloting: {
        abilities?: string[];
        techLevel?: number;
        active: {
            [k: string]: boolean;
        };
    };
    spParts: import("salvageunion-reference/rules").StatBreakdown;
    maxSP: number;
    maxEP: number;
    maxHeat: number;
};
export type PilotStatus = {
    /** Derived max HP at or below 0. */
    dead: boolean;
    /** Carrying at least one injury. */
    injured: boolean;
    /** Ejected from their mech, and not aboard one since (the seat says). */
    ejected: boolean;
};
export declare function pilotStatus(pilot: Pilot, crawler: Pick<Crawler, 'techLevel'> | null, ejected: boolean): PilotStatus;
export type MechStatus = {
    destroyed: boolean;
    shutdown: boolean;
    /** Heat at the mech's Heat Capacity: the next point forces a Reactor Overload. */
    overheating: boolean;
    /** Destroyed systems and modules, by name. */
    destroyedSystems: string[];
    destroyedModules: string[];
};
export declare function mechStatus(mech: Mech, maxHeat: number): MechStatus;
/** Whether the Crew tab flags this pilot: dead, injured or ejected. */
export declare function pilotNeedsAttention(status: PilotStatus): boolean;
/** Whether the Crew tab flags this mech: destroyed, overheating, or an item destroyed. */
export declare function mechNeedsAttention(status: MechStatus): boolean;
