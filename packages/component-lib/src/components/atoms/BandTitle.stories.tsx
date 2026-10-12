import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { borderWidth, color, font, fontSize, space, tracking } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Badge } from './Badge'
import { BandTitle } from './BandTitle'
import { Button } from './Button'

export default {
  title: 'Atoms/Band Title',
}

/** A pilot-tone header band, as a `Card` draws it. */
const BAND = {
  alignItems: 'center',
  backgroundColor: color.pilot,
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  display: 'flex',
  gap: space[12],
  paddingBlock: space[8],
  paddingInline: space[12],
  width: '100%',
} satisfies CSSProperties

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  maxWidth: '28rem',
} satisfies CSSProperties

const LABEL = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  marginBottom: space[6],
  textTransform: 'uppercase',
} satisfies CSSProperties

function Band({ children }: { children: ReactNode }) {
  return <div style={BAND}>{children}</div>
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
    <div style={STACK}>
      <div>
        <div style={LABEL}>lead — fills the track</div>
        <Band>
          <BandTitle>{short}</BandTitle>
          <Button variant="default" size="iconOnly" aria-label="Close">
            ×
          </Button>
        </Band>
      </div>

      <div>
        <div style={LABEL}>lead — truncates rather than pushing the control off</div>
        <Band>
          <BandTitle>{longest}</BandTitle>
          <Button variant="default" size="iconOnly" aria-label="Close">
            ×
          </Button>
        </Band>
      </div>

      <div>
        <div style={LABEL}>mute — a secondary band label</div>
        <Band>
          <BandTitle>{short}</BandTitle>
          <BandTitle variant="mute" fill={false}>
            Salvage
          </BandTitle>
        </Band>
      </div>

      <div>
        <div style={LABEL}>contrast — a stamp beside it, sized to its own text</div>
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
