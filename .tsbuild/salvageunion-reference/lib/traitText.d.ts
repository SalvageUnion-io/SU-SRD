/**
 * Trait-reference markup in rules text: `[[TraitName]]` and
 * `[[[TraitName] (param)]]`.
 *
 * Pure string work — nothing here touches entities or the ORM.
 *
 * The package barrel (`lib/index.ts`) re-exports, by name, only what
 * consumers import.
 */
/**
 * Represents a parsed trait reference from text
 */
export type ParsedTraitReference = {
    /** The full matched text including brackets */
    fullMatch: string;
    /** The trait name (e.g., "Hot", "Burn", "Explosive") */
    traitName: string;
    /** The parameter if present (e.g., "3", "X", "2") */
    parameter?: string;
    /** The start index of the match in the original text */
    startIndex: number;
    /** The end index of the match in the original text */
    endIndex: number;
};
/**
 * Parse trait references from text
 * Handles both simple [[TraitName]] and parameterized [[[TraitName] (param)]] formats
 * @param text - The text to parse for trait references
 * @returns Array of parsed trait references
 *
 * @example
 * const text = "This has the [[Shield]] Trait and [[[Hot] (3)]] Trait"
 * const refs = parseTraitReferences(text)
 * // => [
 * //   { fullMatch: "[[Shield]]", traitName: "Shield", startIndex: 13, endIndex: 23 },
 * //   { fullMatch: "[[[Hot] (3)]]", traitName: "Hot", parameter: "3", startIndex: 35, endIndex: 48 }
 * // ]
 */
export declare function parseTraitReferences(text: string): ParsedTraitReference[];
/**
 * Rewrite every trait reference in `text` through `render`, leaving the
 * surrounding prose untouched.
 *
 * This exists so a consumer that only wants to SUBSTITUTE (the Discord bot
 * turning each reference into a markdown link, say) composes the canonical
 * parser instead of re-implementing the bracket grammar with a regex of its
 * own — which is exactly how three subtly different `[[Trait]]` regexes came
 * to exist. Renderers that need positions (React, which must interleave nodes
 * rather than strings) still call {@link parseTraitReferences} directly; this
 * is the string-in/string-out shape on top of it, not a second grammar.
 *
 * @param text - Rules text possibly containing `[[Trait]]` / `[[[Trait] (p)]]`
 * @param render - Maps one parsed reference to its replacement text
 * @returns The text with every reference replaced
 *
 * @example
 * replaceTraitReferences(text, (ref) =>
 *   ref.parameter ? `${link(ref.traitName)} ${ref.parameter}` : link(ref.traitName)
 * )
 */
export declare function replaceTraitReferences(text: string, render: (reference: ParsedTraitReference) => string): string;
/**
 * The text with each trait reference read as plain words — `[[Vulnerable]]` as
 * "Vulnerable", `[[[Hot] (3)]]` as "Hot (3)" — for a surface that prints
 * prose without rendering references (a clamped lead, the static fallback,
 * meta text).
 */
export declare function plainTraitText(text: string): string;
