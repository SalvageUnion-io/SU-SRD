/**
 * SavePatternButton — the builder's review saves the mech being built as a
 * pattern: a Button that opens the one Save as pattern dialog
 * (`SavePatternDialog`), the pattern listed as its chassis would list it, in
 * Edit. The builder stays where it is once it lands.
 */

import { useState } from 'react'
import { Button } from '../../../components/index'
import { mechCopy } from '../../../messages/build-mech'
import type { PatternSource } from './SavePatternDialog'
import { SavePatternDialog } from './SavePatternDialog'

type SavePatternButtonProps = {
  /** The mech being built: its name pre-fills the pattern's. */
  source: PatternSource
}

export function SavePatternButton({ source }: SavePatternButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {mechCopy('saveAsPattern')}
      </Button>
      <SavePatternDialog source={source} open={open} onOpenChange={setOpen} stay />
    </>
  )
}
