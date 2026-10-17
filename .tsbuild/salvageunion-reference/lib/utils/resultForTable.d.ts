import type { RefObjectTable, RefObjectTableContent } from '../schemas/index';
/**
 * The multi-column (two-roll) member of the table union
 */
type ColumnsTable = Extract<RefObjectTable, {
    type: 'columns';
}>;
/**
 * Result type for columns table roll resolution (two d20 rolls)
 */
export type ColumnsTableRollResult = {
    success: boolean;
    columnKey: string;
    entryKey: string;
    result: RefObjectTableContent;
};
/**
 * Checks whether a table is a columns-type table (multi-column, two-roll)
 */
export declare function isColumnsTable(table: RefObjectTable | undefined): table is ColumnsTable;
/**
 * Resolves two d20 rolls against a columns-type table
 *
 * @param table - The roll table data
 * @param columnRoll - First d20 roll to select a column (1-20)
 * @param entryRoll - Second d20 roll to select an entry within the column (1-20)
 * @returns Object with success flag, column key, entry key, and result
 */
export declare function resultForColumnsTable(table: RefObjectTable | undefined, columnRoll: number, entryRoll: number): ColumnsTableRollResult;
/**
 * Result type for table roll resolution
 */
export type TableRollResult = {
    success: boolean;
    result: RefObjectTableContent;
    key: string;
};
/**
 * Resolves a d20 roll against a table to get the result
 *
 * @param table - The roll table data (RefRollTable['table'] | RefSystem['table'] | undefined)
 * @param roll - The d20 roll result (1-20)
 * @returns Object with success flag and result object containing optional label and required value
 *
 * @example
 * const rollTable = SalvageUnionReference.RollTables.findByName('Core Mechanic');
 * const result = resultForTable(rollTable?.table, 15);
 * if (result.success) {
 *   console.log(result.result.value); // "You have achieved your goal..."
 *   console.log(result.result.label); // "Success" (if present)
 * }
 */
export declare function resultForTable(table: RefObjectTable | undefined, roll: number): TableRollResult;
/**
 * Whether `roll` (1–20) misses every row of a well-formed flat table: the table
 * has rows, and none of their keys covers the roll. A `dramatic` table prints
 * only its 20, so every other roll has no effect. A malformed table (no rows,
 * unreadable content), a columns table or an impossible roll is not a miss: it
 * is a fault.
 */
export declare function isNoEffectRoll(table: RefObjectTable | undefined, roll: number): boolean;
export {};
