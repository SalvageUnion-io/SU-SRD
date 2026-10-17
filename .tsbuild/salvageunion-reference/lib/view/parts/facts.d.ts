/**
 * An entity's STATS as facts: the head's cells and the page's stat column.
 * the UI library's `referenceEntityStatsConfig.ts` builds its `StatItem`s from
 * these.
 */
import type { RefEnumSchemaName, RefMetaEntity } from '../../schemas/index';
import type { Fact, StatGroup } from '../types';
/** A stat's names, as every surface prints it: one vocabulary, read everywhere. */
export type StatLabel = {
    /** The full name, two words: a full-size value box sets one per line. */
    label: string;
    /** The game's own abbreviation, or the first word where that already is one. */
    short: string;
};
/**
 * Every stat's names, keyed as the data names the stat (a contribution's
 * `stat`, a getter's field). The sheet rails, the Discord bot and a pattern's
 * stat plates read these rather than spelling their own.
 */
export declare const STAT_LABELS: {
    readonly slotsRequired: {
        readonly label: 'Slots Required';
        readonly short: 'Slots';
    };
    readonly structurePoints: {
        readonly label: 'Structure Points';
        readonly short: 'SP';
    };
    readonly hitPoints: {
        readonly label: 'Hit Points';
        readonly short: 'HP';
    };
    readonly energyPoints: {
        readonly label: 'Energy Points';
        readonly short: 'EP';
    };
    readonly salvageValue: {
        readonly label: 'Salvage Value';
        readonly short: 'SV';
    };
    readonly bioSalvageValue: {
        readonly label: 'Bio-Salvage Value';
        readonly short: 'Bio';
    };
    readonly systemSlots: {
        readonly label: 'System Slots';
        readonly short: 'SYS';
    };
    readonly moduleSlots: {
        readonly label: 'Module Slots';
        readonly short: 'MODS';
    };
    readonly cargoCapacity: {
        readonly label: 'Cargo Capacity';
        readonly short: 'Cargo';
    };
    readonly heatCapacity: {
        readonly label: 'Heat Capacity';
        readonly short: 'Heat';
    };
    readonly upkeepCost: {
        readonly label: 'Upkeep Cost';
        readonly short: 'Upkeep';
    };
    readonly upgradeCost: {
        readonly label: 'Upgrade Cost';
        readonly short: 'Upgrade';
    };
};
/**
 * The condition of a Mech Chassis, System or Module (Workshop Manual
 * pp.244-245): Intact, Damaged or Destroyed, keyed as the data stores it.
 */
export declare const CONDITION_LABELS: {
    readonly intact: 'Intact';
    readonly damaged: 'Damaged';
    readonly destroyed: 'Destroyed';
};
export type ItemCondition = keyof typeof CONDITION_LABELS;
/**
 * Each action type as the Core Book prints it on an action's line, keyed as
 * the data stores it: "Turn Action" (p.237), "Free Action", "Short Action",
 * "Long Action" and "Downtime Action", one word (p.238), but a bare
 * "Reaction" (p.238) and "Passive" (the legend, p.23).
 */
export declare const ACTION_TYPE_LABELS: {
    readonly Turn: 'Turn Action';
    readonly Free: 'Free Action';
    readonly Short: 'Short Action';
    readonly Long: 'Long Action';
    readonly DownTime: 'Downtime Action';
    readonly Reaction: 'Reaction';
    readonly Passive: 'Passive';
};
type StatOptions = {
    schemaName?: RefEnumSchemaName | 'actions';
    techLevel?: number | 'B' | 'N';
};
/**
 * The entity's stats as every form but a Page prints them, in THE order
 * (`STATS`), the Tech Level not among them (`techLevelFact` leads them). A
 * chassis keeps its chip set (`CHASSIS_CHIPS`).
 */
export declare function entityStats(entity: RefMetaEntity, options: StatOptions): Fact[];
/** The Tech Level as a fact, keyed as the head's TL cell: first of every stat line. */
export declare function techLevelFact(techLevel: number | 'B' | 'N'): Fact;
/**
 * The page's stat column: the Tech Level, then every stat, in THE order
 * (`STATS`), under its full name ("Structure Points", never the book's
 * "Structure Pts."): a Page's band and a chassis's body stats print the long
 * label, every smaller form the short one, in the same order.
 */
export declare function bookStats(entity: RefMetaEntity, options: StatOptions): Fact[];
type Grouped = {
    group?: StatGroup;
};
/**
 * A stat line split where its action starts: the stats (provenance, vitals,
 * capacity) lead, then the action type (drawn by the caller), then the
 * action's facets (RNG, DMG). A cell with no group stays where it is.
 */
export declare function splitStatLine<T extends Grouped>(cells: readonly T[]): {
    stats: T[];
    action: T[];
};
/** Whether a cell opens a new group (a stat column's new row): its group differs from the last one's. */
export declare function opensGroup<T extends Grouped>(cells: readonly T[], index: number): boolean;
export {};
