/**
 * PatternDescriptionDialog — a saved pattern's description, edited on its own
 * page (r4 E13): the words its maker wrote when saving it, where a book
 * pattern's prose goes. One field, Save; emptied, the pattern has none.
 */
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { DialogActions, FieldError } from '../../../components/app'
import { Button, ModalShell, Textarea, tokens } from '../../../components/index'
import { useServerAction } from '../../../lib/connection/useServerAction'
import { mechCopy } from '../../../messages/build-mech'

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties
const FIELD = { width: '100%' } satisfies CSSProperties

type Props = {
  open: boolean
  onClose: () => void
  /** The pattern's name, for the dialog's title. */
  name: string
  description: string
  save: (description: string) => Promise<unknown>
}

export function PatternDescriptionDialog({ open, onClose, name, description, save }: Props) {
  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={mechCopy('editDescriptionOf', { name })}
      width="default"
    >
      {/* Mounted per opening, so the field starts from the saved words. */}
      {open && <Body description={description} save={save} onClose={onClose} />}
    </ModalShell>
  )
}

function Body({ description, save, onClose }: Pick<Props, 'description' | 'save' | 'onClose'>) {
  const [text, setText] = useState(description)
  const write = useServerAction((next: string) => save(next), {
    failure: mechCopy('descriptionNotSaved'),
  })

  async function confirm() {
    const next = text.trim()
    if (next !== description.trim()) {
      const result = await write.run(next)
      if (!result.ok) return
    }
    onClose()
  }

  return (
    <div style={BODY}>
      <Textarea
        aria-label={mechCopy('patternDescription')}
        placeholder={mechCopy('whatItIsForAnd')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        autoFocus
        style={FIELD}
      />
      {write.error && <FieldError>{write.error}</FieldError>}
      <DialogActions>
        <Button variant="ghost" size="compact" onClick={onClose} disabled={write.pending}>
          {mechCopy('cancel')}
        </Button>
        <Button
          variant="primary"
          size="compact"
          onClick={() => void confirm()}
          disabled={write.pending}
        >
          {write.pending ? mechCopy('saving') : mechCopy('save')}
        </Button>
      </DialogActions>
    </div>
  )
}
