import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Badge } from './Badge'
import { BandTitle } from './BandTitle'
import { Button } from './Button'

export default {
  title: 'Atoms/Band Title',
}

function Band({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-3 border-chrome border-ink bg-pilot px-3 py-2">
      {children}
    </div>
  )
}

/** `BandTitle` — the paper-on-tone title inside a `Card`'s header band.
 *
 *  It is deliberately NOT `Badge shape="stamp"`, and the last example shows
 *  why: a stamp is intrinsically sized (`w-fit`), which is what lets it ride a
 *  seam. A band title takes its width from the band's flex track and truncates,
 *  because the band also has to hold the controls beside it. */
export const Default: Story = () => {
  const chassis = SalvageUnionReference.Chassis.all()
  const short = chassis[0]?.name ?? 'Mule'
  // A real entity with a long name, so truncation is exercised by production
  // content rather than by an invented string.
  const longest = [...chassis].sort((a, b) => b.name.length - a.name.length)[0]?.name ?? short

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <div className="mb-1.5 font-cond text-label uppercase tracking-caps text-wk-muted">
          lead — fills the track
        </div>
        <Band>
          <BandTitle>{short}</BandTitle>
          <Button variant="default" size="iconOnly" aria-label="Close">
            ×
          </Button>
        </Band>
      </div>

      <div>
        <div className="mb-1.5 font-cond text-label uppercase tracking-caps text-wk-muted">
          lead — truncates rather than pushing the control off
        </div>
        <Band>
          <BandTitle>{longest}</BandTitle>
          <Button variant="default" size="iconOnly" aria-label="Close">
            ×
          </Button>
        </Band>
      </div>

      <div>
        <div className="mb-1.5 font-cond text-label uppercase tracking-caps text-wk-muted">
          mute — a secondary band label
        </div>
        <Band>
          <BandTitle>{short}</BandTitle>
          <BandTitle variant="mute" fill={false}>
            Salvage
          </BandTitle>
        </Band>
      </div>

      <div>
        <div className="mb-1.5 font-cond text-label uppercase tracking-caps text-wk-muted">
          contrast — a stamp beside it, sized to its own text
        </div>
        <Band>
          <BandTitle>{longest}</BandTitle>
          <Badge shape="stamp" size="mini">
            {short}
          </Badge>
        </Band>
      </div>
    </div>
  )
}
