import type { LockEntry, ProseItem } from './proseFidelity';
/** A string's ruling, or `undefined`; `repeats` is how often its text occurs in the dataset. */
export declare function ruling(item: Pick<ProseItem, 'kind' | 'file' | 'entityName' | 'text'>, repeats: number): Omit<LockEntry, 'hash'> | undefined;
