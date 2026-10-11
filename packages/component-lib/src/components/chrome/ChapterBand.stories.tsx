import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { UserMadeStamp } from '../referenceEntity/card/UserMadeStamp'
import { Badge } from './Badge'
import { ChapterBand } from './ChapterBand'

export default {
  title: 'Atoms/Chapter Band',
}

// Real SRD content — reference data is preloaded by catalog.tsx.
const gopher = SalvageUnionReference.Chassis.getByName('Gopher')
const pilotClass = SalvageUnionReference.Classes.all()[0]
const crawler = SalvageUnionReference.Crawlers.all()[0]
const bioTitan = SalvageUnionReference.BioTitans.all()[0]

const STACK = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties

// The page ground under each band, so the notch reads as cut out of it.
const PAGE = { backgroundColor: color.wkBg, paddingBottom: space[16] } satisfies CSSProperties

const STAMPS = { display: 'flex', gap: space[6] } satisfies CSSProperties

/**
 * The page title as the Workshop Manual sets it: a band in the chapter's
 * colour with ink speckle, the title notched into its foot in ink on the page
 * ground — never a white knockout. It replaced `PageHeading`'s ink-stamp page
 * heading (boards 06, 07, 09 and 10). One band per tone of the book's colour
 * map, with an entity's stamps as the `aside` on the Mech Workshop band.
 */
export const Default: Story = () => (
  <div style={STACK}>
    <div style={PAGE}>
      <Caption>rules — Contents, Core Rules, Salvaging, Guides, Keywords</Caption>
      <ChapterBand measure="80rem">The Salvage Union SRD</ChapterBand>
    </div>
    <div style={PAGE}>
      <Caption>mech — with an aside (the entity's stamps)</Caption>
      <ChapterBand
        tone="mech"
        measure="80rem"
        aside={
          <span style={STAMPS}>
            <Badge shape="stamp" size="full">
              Mech Chassis
            </Badge>
            <Badge shape="stamp" size="full" surface="inverse">
              TL {gopher?.techLevel ?? 2}
            </Badge>
          </span>
        }
      >
        {gopher?.name ?? 'Gopher'}
      </ChapterBand>
    </div>
    <div style={PAGE}>
      <Caption>pilot</Caption>
      <ChapterBand tone="pilot">{pilotClass?.name ?? 'Pilot Bay'}</ChapterBand>
    </div>
    <div style={PAGE}>
      <Caption>pilot — with an eyebrow (a sheet's stamps and provenance, board 10)</Caption>
      <ChapterBand
        tone="pilot"
        measure="80rem"
        eyebrow={
          <>
            <Badge shape="stamp" size="full">
              Pilot
            </Badge>
            <Badge shape="stamp" size="full" surface="inverse">
              {pilotClass?.name ?? 'Engineer'}
            </Badge>
            <span>Starter Set · Leyline Press · read-only</span>
          </>
        }
      >
        Bonesaw
      </ChapterBand>
    </div>
    <div style={PAGE}>
      <Caption>crawler</Caption>
      <ChapterBand tone="crawler">{crawler?.name ?? 'Union Crawler'}</ChapterBand>
    </div>
    <div style={PAGE}>
      <Caption>denizen — the navy band</Caption>
      <ChapterBand tone="denizen">{bioTitan?.name ?? 'Denizens'}</ChapterBand>
    </div>
  </div>
)

/**
 * USER-MADE (ruleset §3.9, issue 1276): a full page a player made that could
 * pass for the book — a shared mech pattern (board P2). The band is hatched in
 * ink over the chapter colour, the notched title is framed in dashes, and the
 * stamps lead the title as its `eyebrow`. Shown beside the canon band it must
 * never be mistaken for.
 */
export const UserMade: Story = () => (
  <div style={STACK}>
    <div style={PAGE}>
      <Caption>canon — solid</Caption>
      <ChapterBand tone="mech" measure="80rem">
        {gopher?.name ?? 'Gopher'}
      </ChapterBand>
    </div>
    <div style={PAGE}>
      <Caption>user-made — hatched band, dashed notch, stamps as the eyebrow</Caption>
      <ChapterBand
        tone="mech"
        measure="80rem"
        userMade
        eyebrow={
          <>
            <UserMadeStamp label="User-made pattern" />
            <Badge shape="stamp" size="full">
              Chassis {gopher?.name ?? 'Gopher'}
            </Badge>
            <Badge shape="stamp" size="full" surface="inverse">
              TL {gopher?.techLevel ?? 2}
            </Badge>
          </>
        }
      >
        &ldquo;Tow Rig&rdquo;
      </ChapterBand>
    </div>
  </div>
)
