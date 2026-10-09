import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Button } from '../chrome/Button'
import { PopoverPanel } from './PopoverPanel'

export default {
  title: 'Containers/Popover Panel',
}

const FRAME = {
  alignItems: 'flex-start',
  display: 'flex',
  justifyContent: 'flex-end',
  minHeight: '14rem',
  padding: space[16],
} satisfies CSSProperties

/**
 * PopoverPanel — a trigger and the small panel of controls it opens beside it,
 * as ITUN's live sheet uses it: the "⋯" overflow holding the sheet's Print,
 * Export and Change Log. Opens itself on mount by pressing its own trigger;
 * Escape, a press outside or the trigger closes it.
 */
export const Default: Story = () => {
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    frameRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')?.click()
  }, [])

  return (
    <div>
      <Caption>the sheet's ⋯ overflow, opened</Caption>
      <div ref={frameRef} style={FRAME}>
        <PopoverPanel
          label="Sheet actions"
          trigger={
            <Button size="compact" aria-label="More actions">
              ⋯
            </Button>
          }
        >
          <Button variant="ghost" size="compact">
            Print
          </Button>
          <Button variant="ghost" size="compact">
            Export
          </Button>
          <Button variant="ghost" size="compact">
            Change Log
          </Button>
        </PopoverPanel>
      </div>
    </div>
  )
}
