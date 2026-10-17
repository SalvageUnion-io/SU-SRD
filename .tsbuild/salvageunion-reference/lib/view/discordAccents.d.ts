/**
 * Every Discord accent colour, in the one form Discord's `setAccentColor()`
 * takes: the `0xRRGGBB` integer.
 *
 * Each is a mirror of a `--color-*` token in `apps/web/src/styles/theme.css`:
 * the tokens are the authority, and `__tests__/discordAccents.test.ts` reads
 * the stylesheet and fails if any value here drifts. The reference cards (the
 * bot's lookup and the SRD's Component Embed), the bot's rolls and its system
 * replies all read them from here.
 */
/**
 * The accent stripe for each tone, a mirror of `--color-<tone>`, with two
 * deliberate changes: `ink` and `ink-2` paint the rules blue (`--color-wk-line`),
 * the band the glossary chapters wear, because a near-black stripe vanishes on
 * Discord's dark theme; and `crawler` paints the crawler band, the pink every
 * crawler header on the web paints, so a crawler is one pink everywhere.
 */
export declare const DISCORD_TONE_ACCENT: Readonly<Record<string, number>>;
/** A tone's accent; an unknown tone takes the rules blue. */
export declare function discordAccent(tone: string): number;
/**
 * The Core Mechanic roll-outcome accents: the canon `--color-roll-*` ramp.
 * Damaged and destroyed state share the same warm ramp, so `cascade` is also
 * a wrecked sheet's accent.
 */
export declare const DISCORD_ROLL_ACCENT: {
    /** 20 · Nailed It — `--color-roll-nailed`. */
    readonly nailed: 4949664;
    /** 11–19 · Success — `--color-roll-success`. */
    readonly success: 7309898;
    /** 6–10 · Tough Choice — `--color-roll-tough`. */
    readonly tough: 12687934;
    /** 2–5 · Failure — `--color-roll-failure`. */
    readonly failure: 12614191;
    /** 1 · Cascade Failure — `--color-roll-cascade`. */
    readonly cascade: 11551531;
};
/**
 * The neutral accent for replies without pass/fail semantics (errors, system
 * replies): `--color-rust`, "THE single action color".
 */
export declare const DISCORD_NEUTRAL_ACCENT = 11031074;
