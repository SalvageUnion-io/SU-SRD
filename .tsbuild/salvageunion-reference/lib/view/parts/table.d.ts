/**
 * An entity's ROLL TABLE.
 */
import type { RefObjectTable } from '../../schemas/index';
import type { EntityTable } from '../types';
/**
 * The table a record carries: INLINE as `table`, or BY REFERENCE as a
 * `tableName` naming a `roll-tables` entry (an ability like "System and
 * Software Hacker" IS its d20 outcomes). Degrades to no table when the
 * `roll-tables` schema is not loaded.
 */
export declare function resolveTable(source: unknown): RefObjectTable | undefined;
/** The model's table: the record's own, else its folded self-action's. */
export declare function entityTable(entity: unknown, folded: unknown, entityName: string): EntityTable | undefined;
