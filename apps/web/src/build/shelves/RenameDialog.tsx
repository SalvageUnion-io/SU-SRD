/**
 * RenameDialog — a shelf row's name, changed from its ⋯ menu without opening
 * its sheet: one field, Save. An empty name is never written.
 */
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { DialogActions, FieldError } from '../../components/app'
import { Button, Input, ModalShell, tokens } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { buildShelvesCopy } from '../../messages/build-shelves'
import type { RenameSubject } from './shelfMenu.model'

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties
const FIELD = { width: '100%' } satisfies CSSProperties

export function RenameDialog({
  subject,
  onClose,
}: {
  /** Null while nothing is being renamed. */
  subject: RenameSubject | null
  onClose: () => void
}) {
  return (
    <ModalShell
      open={subject !== null}
      onOpenChange={(open) => !open && onClose()}
      title={subject ? buildShelvesCopy('renameName', { name: subject.name }) : ''}
      width="narrow"
    >
      {/* Mounted per subject, so the field starts from that row's name. */}
      {subject && <RenameBody subject={subject} onClose={onClose} />}
    </ModalShell>
  )
}

function RenameBody({ subject, onClose }: { subject: RenameSubject; onClose: () => void }) {
  const [name, setName] = useState(subject.name)
  const save = useServerAction((next: string) => subject.save(next), {
    failure: buildShelvesCopy('renameFailed'),
  })
  const next = name.trim()

  async function confirm() {
    if (!next) return
    if (next !== subject.name) {
      const result = await save.run(next)
      if (!result.ok) return
    }
    onClose()
  }

  return (
    <div style={BODY}>
      <Input
        aria-label={subject.label}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void confirm()
        }}
        autoFocus
        // It opens with the old name selected, so typing replaces it.
        onFocus={(e) => e.currentTarget.select()}
        style={FIELD}
        required
      />
      {save.error && <FieldError>{save.error}</FieldError>}
      <DialogActions>
        <Button variant="ghost" size="compact" onClick={onClose} disabled={save.pending}>
          {buildShelvesCopy('cancel')}
        </Button>
        <Button
          variant="primary"
          size="compact"
          onClick={() => void confirm()}
          disabled={save.pending || !next}
        >
          {buildShelvesCopy('rename')}
        </Button>
      </DialogActions>
    </div>
  )
}
