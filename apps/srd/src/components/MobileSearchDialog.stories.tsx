import { SearchField } from 'component-lib'
import { color, font, fontSize, space, weight } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { MobileSearchDialog } from './MobileSearchDialog'

export default {
  title: 'Containers/Mobile Search Dialog',
}

const BAR = {
  alignItems: 'center',
  backgroundColor: color.ink,
  borderRadius: '0.25rem',
  display: 'flex',
  gap: space[12],
  paddingBlock: space[8],
  paddingInline: space[16],
} satisfies CSSProperties

const WORDMARK = {
  color: color.paper,
  fontFamily: font.cond,
  fontSize: fontSize.sm,
  fontWeight: weight.bold,
  lineHeight: 'calc(1.25 / 0.875)',
  textTransform: 'uppercase',
} satisfies CSSProperties

const TRAILING = { marginLeft: 'auto' } satisfies CSSProperties

/**
 * The mobile top-nav search trigger + full-screen sheet. Tap the magnifier to
 * open the sheet; the injected search content mounts only while open. Here the
 * content is the shared `SearchField` (srd injects its full `SearchIsland`
 * combobox instead).
 */
export const Default = () => {
  const [q, setQ] = useState('Iron Mongrel')
  return (
    <div style={BAR}>
      <span style={WORDMARK}>Salvage Union</span>
      <div style={TRAILING}>
        <MobileSearchDialog triggerAriaLabel="Search the SRD">
          <div className="srd-mobile-search__body">
            <SearchField
              type="search"
              aria-label="Search the SRD"
              placeholder="Search the SRD…"
              glyphSize={16}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </MobileSearchDialog>
      </div>
    </div>
  )
}
