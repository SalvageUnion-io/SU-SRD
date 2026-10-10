import { color, font, fontSize, space, tracking, weight } from '../../../design/tokens'

/**
 * CRAWLER BAY "WHEN DAMAGED" callout — the card's own anatomy at callout
 * scale: an ink band naming the condition over the effect on paper, framed in
 * ink. The damage reads as a treatment on the bay's rules, not as a second
 * hue (ruleset §3.3), which is why the ghosted danger tint it used to wear is
 * gone with the rest of the ghosted tones. The card filters the same string
 * out of its body prose, so it is said once.
 */
export function DamagedEffectCallout({ effect }: { effect: string }) {
  return (
    <div
      style={{
        border: 'var(--bw-chrome) solid var(--color-ink)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-ink)',
          color: 'var(--color-paper)',
          fontFamily: font.cond,
          fontSize: fontSize.xs,
          fontWeight: weight.bold,
          letterSpacing: tracking.capsTight,
          lineHeight: 1,
          padding: `${space[6]} ${space[8]}`,
          textTransform: 'uppercase',
        }}
      >
        When Damaged
      </div>
      <p
        style={{
          backgroundColor: 'var(--color-paper)',
          color: color.ink,
          fontSize: fontSize.xs,
          lineHeight: 1.4,
          margin: 0,
          padding: space[8],
        }}
      >
        {effect}
      </p>
    </div>
  )
}
