/**
 * The roll table's two pure helpers, beside `RollTableInstrument` so a host
 * (a card's readout, a test) reads them without the component.
 */

/** A range key as the book prints it: "11–19", with an en dash. */
export const rollRangeLabel = (key: string) => key.replace('-', '–')

/**
 * The band a surface tone paints: a quarter of the tone into paper, light
 * enough that ink reads on every tone a surface wears (`contrast.test.ts`);
 * cream, the book's d20 band, where the surface has no tone.
 */
export function rollBandColor(tone: string | undefined): string {
  return tone ? `color-mix(in srgb, ${tone} 25%, var(--color-paper))` : 'var(--color-band-cream)'
}
