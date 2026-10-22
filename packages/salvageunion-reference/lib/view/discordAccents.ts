/**
 * Every Discord accent colour, in the one form Discord's `setAccentColor()`
 * takes: the `0xRRGGBB` integer.
 *
 * Each tone and state accent is a mirror of a `--color-*` token in
 * `apps/web/src/styles/theme.css`: the tokens are the authority, and `__tests__/discordAccents.test.ts` reads
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
export const DISCORD_TONE_ACCENT: Readonly<Record<string, number>> = {
  pilot: 0xef894f,
  mech: 0x7a978a,
  crawler: 0xb84a86,
  'crawler-band': 0xb84a86,
  'denizen-band': 0x2f4a66,
  adversary: 0x8c4b38,
  'tier-hybrid': 0xb7410e,
  'class-hybrid': 0x6b4423,
  'tl-1': 0x73c9e6,
  'tl-2': 0x57a9c8,
  'tl-3': 0x5391a9,
  'tl-4': 0x306b80,
  'tl-5': 0x1e5364,
  'tl-6': 0x063441,
  'tl-b': 0x569c68,
  'tl-n': 0x8664a9,
  'wk-line': 0x8fc3d8,
  ink: 0x8fc3d8,
  'ink-2': 0x8fc3d8,
}

/** A tone's accent; an unknown tone takes the rules blue. */
export function discordAccent(tone: string): number {
  return DISCORD_TONE_ACCENT[tone] ?? 0x8fc3d8
}

/**
 * The Core Mechanic roll-outcome accents: the roll tiers, the bot's alone
 * (ruleset §3.4: the web never colours a roll outcome). This is where they
 * are defined. Three share the web's warm state ramp (`--color-status-*`), so
 * `cascade` is also a wrecked sheet's accent; tough and nailed are the bot's.
 */
export const DISCORD_ROLL_ACCENT = {
  /** 20 · Nailed It — slate. */
  nailed: 0x4b86a0,
  /** 11–19 · Success — olive, `--color-status-ok`. */
  success: 0x6f8a4a,
  /** 6–10 · Tough Choice — ochre. */
  tough: 0xc19a3e,
  /** 2–5 · Failure — ember, `--color-status-warn`. */
  failure: 0xc07a2f,
  /** 1 · Cascade Failure — brick, `--color-status-bad`. */
  cascade: 0xb0432b,
} as const

/**
 * The neutral accent for replies without pass/fail semantics (errors, system
 * replies): `--color-rust`, "THE single action color".
 */
export const DISCORD_NEUTRAL_ACCENT = 0xa85222
