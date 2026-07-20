import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { Button } from './Button'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Button',
}

// The `.btn` cva ships four variants (buttonVariants.ts). `secondary` / `control`
// are named in the codex but not yet implemented — only the real ones render.
const BTN_VARIANTS = ['default', 'primary', 'ghost', 'danger'] as const
const BTN_SIZES = ['sm', 'md', 'lg'] as const

type BtnVariant = (typeof BTN_VARIANTS)[number]

/**
 * One story per variant: every size (sm/md/lg) plus the disabled treatment
 * (opacity .4, pointer-events none). Labels are sentence-case bodies — a Button is
 * never a stamp.
 */
function VariantShowcase({ variant, label }: { variant: BtnVariant; label: string }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Caption>{variant} · sizes</Caption>
        <div className="flex flex-wrap items-start gap-3">
          {BTN_SIZES.map((size) => (
            <Button key={size} variant={variant} size={size}>
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <Caption>{variant} · disabled</Caption>
        <div className="flex flex-wrap items-start gap-3">
          <Button variant={variant} disabled>
            {label}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** `default` — paper/ink outline, the resting non-action button. */
export const Default: Story = () => <VariantShowcase variant="default" label="Cancel" />

/** `primary` — rust, THE single action colour. */
export const Primary: Story = () => <VariantShowcase variant="primary" label="Commit" />

/** `ghost` — transparent ground, ink text; a low-emphasis action. */
export const Ghost: Story = () => <VariantShowcase variant="ghost" label="Details" />

/** `danger` — the warm bad tone for destructive actions. */
export const Danger: Story = () => <VariantShowcase variant="danger" label="Eject" />

/** Every variant side-by-side at md, plus the disabled row, for a scan. */
export const AllVariants: Story = () => (
  <div className="flex flex-col gap-5">
    <div>
      <Caption>every variant · md</Caption>
      <div className="flex flex-wrap items-start gap-3">
        {BTN_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </div>
    </div>
    <div>
      <Caption>every variant · disabled</Caption>
      <div className="flex flex-wrap items-start gap-3">
        {BTN_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant} disabled>
            {variant}
          </Button>
        ))}
      </div>
    </div>
  </div>
)

/**
 * `surface="instrument"` — the same Button re-skinned for the dark dashboard HUD
 * (condensed caps + the paper-tinted ghost border). Rendered on the instrument
 * ground so the paper text reads correctly. `ghost` is the only variant the HUD
 * uses, so it is the only instrument recolour that ships.
 */
export const Instrument: Story = () => (
  <div className="rounded-panel bg-[var(--color-ink-deep)] p-4">
    <div className="flex flex-col gap-5">
      <div>
        <Caption>ghost · instrument</Caption>
        <div className="flex flex-wrap items-start gap-3">
          <Button variant="ghost" surface="instrument">
            SRD
          </Button>
          <Button variant="ghost" surface="instrument" disabled>
            SRD
          </Button>
        </div>
      </div>
      <div>
        <Caption>ghost · instrument · sizes</Caption>
        <div className="flex flex-wrap items-start gap-3">
          {BTN_SIZES.map((size) => (
            <Button key={size} variant="ghost" surface="instrument" size={size}>
              Activate
            </Button>
          ))}
        </div>
      </div>
    </div>
  </div>
)

/**
 * `Button size="xs"` — the compact uppercase action chip (formerly MiniBtn), e.g.
 * '⇄ Swap' on rail chips. Default + disabled.
 */
export const XsButtons: Story = () => (
  <div className="flex flex-col gap-5">
    <div>
      <Caption>default</Caption>
      <div className="flex flex-wrap items-start gap-3">
        <Button size="xs">⇄ Swap</Button>
        <Button size="xs">Remove</Button>
        <Button size="xs">Details</Button>
      </div>
    </div>
    <div>
      <Caption>disabled</Caption>
      <div className="flex flex-wrap items-start gap-3">
        <Button size="xs" disabled>
          ⇄ Swap
        </Button>
      </div>
    </div>
  </div>
)

/**
 * `glyph` — an optional leading decorative glyph rendered aria-hidden before
 * the label, spaced by the button's flex gap. Replaces the hand-rolled
 * `<span aria-hidden>⚄</span> Roll` the wizard roll-assist buttons used to inline.
 */
export const GlyphButtons: Story = () => (
  <div>
    <Caption>roll assist</Caption>
    <div className="flex flex-wrap items-start gap-3">
      <Button size="sm" glyph="⚄">
        Roll callsign
      </Button>
      <Button size="xs" glyph="⚄">
        Roll
      </Button>
    </div>
  </div>
)
