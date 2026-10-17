/**
 * The Discord card's chips, label first (ruleset §3.7) and spelled out, as a
 * full-size value box prints it: Discord has the room the web's compact cells
 * lack. A fact as `**Structure Points** 12`, lines of three, and the cost's
 * pointy box.
 */
import type { EntityModel, Fact } from './types';
/** The facts that have a value, as chips: `**Range** Long`, `**Damage** 9 Structure Points`. */
export declare function factChips(facts: Fact[]): string[];
/** Chips, three to a line: `**Tech Level** 1 · **Structure Points** 12 · **Energy Points** 4`. */
export declare function chipLines(chips: string[], perLine?: number): string[];
/** The cost as the book's pointy box, spelled out: `` `1 Ability Point` ``, `` `2 Energy Points` ``. */
export declare function costChip(model: EntityModel): string | undefined;
