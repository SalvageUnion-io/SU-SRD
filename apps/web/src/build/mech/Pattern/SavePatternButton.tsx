/**
 * SavePatternButton — the builder's review saves the mech being built as a
 * pattern: a Button that opens the one Save as pattern dialog
 * (`SavePatternDialog`), the pattern listed as its chassis would list it, in
 * Edit. The builder stays where it is once it lands. Signed out, the press
 * opens the wizard's own "Sign in to save" instead, before anything is typed
 * (`askSignIn`, r4 E15): a pattern needs an account as Create does.
 */

import { useState } from 'react'
import { Button } from '../../../components/index'
import { mechCopy } from '../../../messages/build-mech'
import type { PatternSource } from './SavePatternDialog'
import { SavePatternDialog } from './SavePatternDialog'

type SavePatternButtonProps = {
  /** The mech being built: its name pre-fills the pattern's. */
  source: PatternSource
  /** Signed out: the wizard's sign-in ask, what Create opens; undefined with an account. */
  askSignIn: (() => void) | undefined
}

export function SavePatternButton({ source, askSignIn }: SavePatternButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" onClick={askSignIn ?? (() => setOpen(true))}>
        {mechCopy('saveAsPattern')}
      </Button>
      <SavePatternDialog source={source} open={open} onOpenChange={setOpen} />
    </>
  )
}
