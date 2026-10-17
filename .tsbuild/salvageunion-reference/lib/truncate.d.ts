/**
 * Cap `text` at `max` characters, ellipsis included, cutting at the last word
 * boundary when one falls in the final 40% of the budget and mid-word only when
 * none does (one very long word).
 *
 * Shared by the Discord bot (embed limits) and srd (meta descriptions).
 */
export declare function truncate(text: string, max: number): string;
