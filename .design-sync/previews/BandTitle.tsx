/* Ported from packages/component-lib/src/components/chrome/BandTitle.stories.tsx. */
import { Badge, BandTitle, Button } from 'component-lib'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

function Band({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-3 border-chrome border-ink bg-pilot px-3 py-2">
      {children}
    </div>
  )
}

/**
 * The paper-on-tone title inside a `Card`'s header band.
 *
 * Deliberately NOT `Badge shape="stamp"`: a stamp is intrinsically sized
 * (`w-fit`), which is what lets it ride a seam. A band title takes its width
 * from the band's flex track and truncates, because the band also has to hold
 * the controls beside it — the last two cells show that contrast.
 */
export function InBand() {
  const chassis = SalvageUnionReference.Chassis.all()
  const short = chassis[0]?.name ?? 'Mule'
  // A real entity with a long name, so truncation is exercised by production
  // content rather than by an invented string.
  const longest = [...chassis].sort((a, b) => b.name.length - a.name.length)[0]?.name ?? short

  return (
    <div className="flex max-w-md flex-col gap-6">
      <Group caption="lead — fills the track">
        <Band>
          <BandTitle>{short}</BandTitle>
          <Button variant="default" size="iconOnly" aria-label="Close">
            ×
          </Button>
        </Band>
      </Group>
      <Group caption="lead — truncates rather than pushing the control off">
        <Band>
          <BandTitle>{longest}</BandTitle>
          <Button variant="default" size="iconOnly" aria-label="Close">
            ×
          </Button>
        </Band>
      </Group>
    </div>
  )
}

/** `variant="mute"` beside the lead, and a stamp for width contrast. */
export function Variants() {
  const chassis = SalvageUnionReference.Chassis.all()
  const short = chassis[0]?.name ?? 'Mule'
  const longest = [...chassis].sort((a, b) => b.name.length - a.name.length)[0]?.name ?? short
  return (
    <div className="flex max-w-md flex-col gap-6">
      <Group caption="mute — a secondary band label">
        <Band>
          <BandTitle>{short}</BandTitle>
          <BandTitle variant="mute" fill={false}>
            Salvage
          </BandTitle>
        </Band>
      </Group>
      <Group caption="contrast — a stamp beside it, sized to its own text">
        <Band>
          <BandTitle>{longest}</BandTitle>
          <Badge shape="stamp" size="mini">
            {short}
          </Badge>
        </Band>
      </Group>
    </div>
  )
}
