/*
 * Ported from packages/component-lib/src/components/chrome/Button.stories.tsx,
 * condensed from eight stories to five cells: the story file gives each variant
 * its own page for side-by-side review in Ladle, which a card grid already does.
 */
import { Button } from 'component-lib'
import { Group, Row, Stack } from '../preview-lib/harness'

// The `.btn` cva ships four variants (buttonVariants.ts). `secondary` /
// `control` are named in the codex but not implemented — only real ones render.
const VARIANTS = ['default', 'primary', 'ghost', 'danger'] as const
// The canonical ladder (styles/sizing.ts): `full` the CTA reading size,
// `compact` the default workhorse, `mini` the uppercase action chip.
const SIZES = ['full', 'compact', 'mini'] as const

/**
 * Every variant at the default size. `primary` is rust — THE single action
 * colour; `default` is the resting paper/ink outline; `danger` is the warm bad
 * tone for destructive actions.
 */
export function Variants() {
  return (
    <Stack gap="1.25rem">
      <Group caption="every variant · default size">
        <Row>
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </Row>
      </Group>
      <Group caption="every variant · disabled (opacity .4, pointer-events none)">
        <Row>
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} disabled>
              {variant}
            </Button>
          ))}
        </Row>
      </Group>
    </Stack>
  )
}

/** The size ladder, on the resting and the action variants. */
export function Sizes() {
  return (
    <Stack gap="1.25rem">
      <Group caption="default · full / compact / mini">
        <Row>
          {SIZES.map((size) => (
            <Button key={size} size={size}>
              Cancel
            </Button>
          ))}
        </Row>
      </Group>
      <Group caption="primary · full / compact / mini">
        <Row>
          {SIZES.map((size) => (
            <Button key={size} variant="primary" size={size}>
              Commit
            </Button>
          ))}
        </Row>
      </Group>
    </Stack>
  )
}

/**
 * `size="mini"` is the uppercase action chip (formerly MiniBtn) — the rail-chip
 * rung. `glyph` prefixes an aria-hidden decorative glyph before the label.
 */
export function ChipsAndGlyphs() {
  return (
    <Stack gap="1.25rem">
      <Group caption="mini · the rail action chip">
        <Row>
          <Button size="mini">⇄ Swap</Button>
          <Button size="mini">Remove</Button>
          <Button size="mini">Details</Button>
          <Button size="mini" disabled>
            ⇄ Swap
          </Button>
        </Row>
      </Group>
      <Group caption="glyph · roll assist">
        <Row>
          <Button size="compact" glyph="⚄">
            Roll callsign
          </Button>
          <Button size="mini" glyph="⚄">
            Roll
          </Button>
        </Row>
      </Group>
    </Stack>
  )
}

/**
 * `surface="instrument"` — the same Button re-skinned for the dashboard HUD
 * (condensed caps, ink hairline). `ghost` is the only variant the HUD uses, so
 * it is the only instrument recolour that ships.
 *
 * Shown on a band-cream chassis, itself on the dark ground. The story file puts
 * these buttons straight onto `--color-ink-deep`, which renders ink-on-ink and
 * is all but invisible; `instruments.css` is explicit that the dashboard is
 * "warm-paper instruments on a dark ground" with `--color-band-cream` as the
 * instrument chassis, and `.su-btn--instrument.su-btn--ghost` sets
 * `color: var(--su-color-ink)`. The chassis is where these actually live.
 */
export function Instrument() {
  return (
    <div className="rounded-panel bg-[var(--color-ink-deep)] p-4">
      <Stack gap="1.25rem">
        <Group caption="ghost · instrument">
          <div className="rounded-panel bg-[var(--color-band-cream)] p-3">
            <Row>
              <Button variant="ghost" surface="instrument">
                SRD
              </Button>
              <Button variant="ghost" surface="instrument" disabled>
                SRD
              </Button>
            </Row>
          </div>
        </Group>
        <Group caption="ghost · instrument · sizes">
          <div className="rounded-panel bg-[var(--color-band-cream)] p-3">
            <Row>
              {SIZES.map((size) => (
                <Button key={size} variant="ghost" surface="instrument" size={size}>
                  Activate
                </Button>
              ))}
            </Row>
          </div>
        </Group>
      </Stack>
    </div>
  )
}
