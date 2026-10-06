import { Search } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Fab } from './Fab'
import { SearchField } from './SearchField'

export default {
  title: 'Containers/Fab',
}

/** Real chassis names, standing in for search results above the input. */
const chassis = SalvageUnionReference.Chassis.all()
  .slice(0, 4)
  .map((c) => c.name)

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  padding: space[12],
} satisfies CSSProperties

const ROW = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  padding: `${space[6]} ${space[8]}`,
} satisfies CSSProperties

/**
 * Fab — the bottom-right floating button that expands into a panel anchored
 * beside it, shown as ITUN uses it: the reference search, results stacked
 * above the input. Starts open; the ✕ collapses it, and Escape or a press
 * outside does too. Content-agnostic — the panel holds whatever the caller
 * passes.
 */
export const Default: Story = () => {
  const [open, setOpen] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <Caption>pinned to the viewport's bottom-right corner</Caption>
      <Fab
        label="Search the rules"
        icon={<Search size={22} aria-hidden="true" />}
        open={open}
        onOpenChange={setOpen}
        initialFocus={inputRef}
      >
        <div style={BODY}>
          {[...chassis].reverse().map((name) => (
            <div key={name} style={ROW}>
              {name}
            </div>
          ))}
          <SearchField ref={inputRef} aria-label="Search the rules" placeholder="Search…" />
        </div>
      </Fab>
    </div>
  )
}
