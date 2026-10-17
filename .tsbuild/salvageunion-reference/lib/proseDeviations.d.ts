/**
 * The prose-deviation allowlist: every way the dataset's text is allowed to
 * differ from the rulebook it transcribes.
 *
 * The package rule is that descriptions and effects are verbatim. This file is
 * the complete list of exceptions, and the only place one may be added.
 * `tools/check-rules-fidelity.ts` compares every prose string with the books
 * and reads this file to tell a deliberate difference from drift; the verdict
 * it reaches for each string is recorded in `fidelity.lock.json`, which the
 * CI gate `tools/check-fidelity-lock.ts` holds the data to. A difference this
 * file does not explain is recorded as `unverified`, never silently accepted.
 *
 * Two kinds of entry:
 *
 *   - RULES (`PROSE_RULES`, `BOOK_TYPOS`) cover a pattern, not a string: a
 *     markup convention, a suffix we add, a class of text we write ourselves.
 *     A rule is cheap to apply and dangerous to widen; each one says what it
 *     admits and why.
 *   - NAMES (`NAME_DEVIATIONS`) are individual rulings on one entity's name,
 *     each enforced by `proseDeviations.test.ts` so the choice cannot be
 *     "corrected" away.
 *
 * Adding an entry is a claim you have checked the book. Include the page.
 */
/** Why a string may differ from the book, as recorded in `fidelity.lock.json`. */
export type ProseRuleId = keyof typeof PROSE_RULES;
export type ProseRule = {
    /** `deviation`: book text, deliberately changed. `authored`: text we wrote. */
    verdict: 'deviation' | 'authored';
    why: string;
};
export declare const PROSE_RULES: {
    readonly 'owner-suffix': {
        readonly verdict: 'deviation';
        readonly why: 'A name the book prints for more than one thing carries its owner in parentheses so each has its own slug: an action shared by several owners ("Servo-Lasso (Free Hill Coalition Squad)", "Constricting Coils (Apophis)"), or a record two books print under the same name ("Salvage Cache Table (We Were Here First!)"). The book prints the bare name; the name without the suffix must match.';
    };
    readonly 'chassis-placeholder': {
        readonly verdict: 'deviation';
        readonly why: 'A Chassis Ability written once for every chassis that has it says "[(CHASSIS)]" (or "[[CHASSIS]]") where the book names the chassis ("the Colossus"). The placeholder must stand for the owning chassis\'s name, or a generic "this Mech"/"it", and the rest must match.';
    };
    readonly 'trait-markup': {
        readonly verdict: 'deviation';
        readonly why: '"[[Hacking]]" links a Trait; the book prints the plain word. The text with the brackets removed must match.';
    };
    readonly 'xref-dropped': {
        readonly verdict: 'deviation';
        readonly why: 'A book cross-reference ("see p. 34") points at a page of the book, which the dataset does not have; the reference is dropped and every other word kept.';
    };
    readonly 'stat-line': {
        readonly verdict: 'deviation';
        readonly why: 'The book sets an item\'s stat line ("Turn Action // Range: Medium // 2 AP // Hacking") inside its text; the dataset holds those values as structured fields, so the only book words missing from the prose are stat words.';
    };
    readonly 'book-typo': {
        readonly verdict: 'deviation';
        readonly why: 'The book misprints a word and the dataset spells it correctly. Each correction is listed in BOOK_TYPOS; nothing else differs.';
    };
    readonly 'printed-name': {
        readonly verdict: 'deviation';
        readonly why: 'A name ruling in NAME_DEVIATIONS.';
    };
    readonly boilerplate: {
        readonly verdict: 'authored';
        readonly why: 'A string repeated verbatim across three or more records ("Choose one.", an NPC\'s stock label) that the book does not print: structure the dataset needs, not transcribed text.';
    };
    readonly structural: {
        readonly verdict: 'authored';
        readonly why: "NPC blocks, choices, options and guide steps are assembled by the dataset from the book's tables and procedures; where such a string matches no book text it is ours. Prose outside those fields never falls under this rule.";
    };
    readonly 'authored-lead': {
        readonly verdict: 'authored';
        readonly why: 'Every top-level roll table leads its listing row with a description. Where the book prints a table with no words of its own to introduce it, the dataset writes one plain line; each is listed in AUTHORED_LEADS, and no other string falls under this rule.';
    };
};
/** Owner suffix on a name: "Name (Owner)". Group 1 is the printed name. */
export declare const OWNER_SUFFIX: RegExp;
/** Where the book names the chassis, the dataset writes one of these. */
export declare const CHASSIS_PLACEHOLDERS: string[];
/** Generic stand-ins the book uses where the dataset says "[(CHASSIS)]". */
export declare const CHASSIS_STAND_INS: readonly ['the Mech', 'this Mech', 'your Mech', 'it'];
/** `[[Trait]]`. Not global, so `.test()` holds no state; replace with `new RegExp(TRAIT_MARKUP, 'g')`. */
export declare const TRAIT_MARKUP: RegExp;
/** A string repeated this many times, matching no book text, is boilerplate. */
export declare const BOILERPLATE_MIN_REPEATS = 3;
/** Fields whose strings the dataset assembles itself (the `structural` rule). */
export declare const STRUCTURAL_FIELDS: readonly ['choices', 'npc', 'options', 'steps'];
export type BookTypo = {
    /** The word as the book prints it. */
    printed: string;
    /** The dataset's spelling. */
    corrected: string;
    source: string;
    page: number;
};
/**
 * Words the book misprints that the dataset corrects. Matched as single words,
 * case-insensitively, and only as the sole difference in a string.
 */
export declare const BOOK_TYPOS: BookTypo[];
/**
 * ## Printed names
 *
 * Entities whose dataset `name` deliberately differs from the heading printed
 * in the rulebook.
 *
 * These are NOT errors. Each one is a considered choice — usually because the
 * book itself uses two names for the same thing (an entry heading plus a
 * different form in its contents list, pattern loadouts, or summary tables) and
 * the dataset picked the form that reads better in a list, or that a public URL
 * already depends on.
 *
 * The problem this file solves is that the choice is invisible in the data. A
 * future contributor re-deriving names from the PDFs sees `Video Projection
 * Array` against a printed heading of `Projection Array`, reads it as a typo,
 * "corrects" it — and silently breaks `/modules/video-projection-array`,
 * a URL that is canon.
 *
 * A documentary `alias` field on the records themselves was considered and
 * rejected: a field written but read by nothing is exactly the `indexable`
 * flag's failure mode (set on 39 records, consumed by no code, impossible to
 * tell whether it is load-bearing), and knip cannot see a dead data field the
 * way it sees a dead export. Encoding the decision as a test instead gives it
 * teeth — renaming one of these to its printed form fails the build, with a
 * message pointing at the reason — and it cannot rot into decoration.
 *
 * Search does not need this list: it already resolves both forms, because the
 * dataset and printed names overlap enough to match on substring.
 *
 * Adding an entry is a claim you have checked the book. Include the page.
 */
export type NameDeviation = {
    /** The `SalvageUnionReference` accessor the entity lives under. */
    schema: 'Modules' | 'Systems' | 'Equipment' | 'CrawlerBays';
    /** The name in the dataset — the canonical one, which slugs and URLs use. */
    name: string;
    /** The heading as printed in the book. */
    printedAs: string;
    /** Printed page carrying that heading. */
    page: number;
    why: string;
};
export declare const NAME_DEVIATIONS: NameDeviation[];
/**
 * ## Authored leads
 *
 * The roll tables whose description the dataset writes itself (the
 * `authored-lead` rule): the book prints the table with no words of its own
 * to introduce it, so its listing row would otherwise lead with nothing. Each
 * is the table's first paragraph, enforced by `proseDeviations.test.ts`.
 *
 * Adding an entry is a claim you have checked the book and found no such
 * words. Include the page.
 */
export type AuthoredLead = {
    /** The roll table's name in the dataset. */
    name: string;
    /** Its first paragraph, as the dataset writes it. */
    text: string;
    /** Printed page carrying the table. */
    page: number;
    why: string;
};
export declare const AUTHORED_LEADS: AuthoredLead[];
