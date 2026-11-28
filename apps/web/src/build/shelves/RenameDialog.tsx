/**
 * RenameDialog — a shelf row's name, changed from its ⋯ menu without opening
 * its sheet: one field, Save (a pilot's two, callsign and name). An empty name
 * is never written.
 */
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { DialogActions, FieldError } from '../../components/app'
import { Button, Field, Input, ModalShell, tokens } from '../../components/index'
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
      title={subject ? buildShelvesCopy('renameName', { name: subject.title ?? subject.name }) : ''}
      width="narrow"
    >
      {/* Mounted per subject, so the field starts from that row's name. */}
      {subject && <RenameBody subject={subject} onClose={onClose} />}
    </ModalShell>
  )
}

function RenameBody({ subject, onClose }: { subject: RenameSubject; onClose: () => void }) {
  const [name, setName] = useState(subject.name)
  const [also, setAlso] = useState(subject.also?.name ?? '')
  const save = useServerAction((next: string, second?: string) => subject.save(next, second), {
    failure: buildShelvesCopy('renameFailed'),
  })
  const next = name.trim()
  const second = subject.also ? also.trim() : undefined
  const filled = next !== '' && second !== ''

  async function confirm() {
    if (!filled) return
    if (next !== subject.name || second !== subject.also?.name) {
      const result = await save.run(next, second)
      if (!result.ok) return
    }
    onClose()
  }
  const onEnter = (e: { key: string }) => {
    if (e.key === 'Enter') void confirm()
  }

  const first = (
    <Input
      aria-label={subject.label}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={onEnter}
      autoFocus
      // It opens with the old name selected, so typing replaces it.
      onFocus={(e) => e.currentTarget.select()}
      style={FIELD}
      required
    />
  )

  return (
    <div style={BODY}>
      {subject.also ? (
        <>
          <Field label={subject.label}>{first}</Field>
          <Field label={subject.also.label}>
            <Input
              aria-label={subject.also.label}
              value={also}
              onChange={(e) => setAlso(e.target.value)}
              onKeyDown={onEnter}
              style={FIELD}
              required
            />
          </Field>
        </>
      ) : (
        first
      )}
      {save.error && <FieldError>{save.error}</FieldError>}
      <DialogActions>
        <Button variant="ghost" size="compact" onClick={onClose} disabled={save.pending}>
          {buildShelvesCopy('cancel')}
        </Button>
        <Button
          variant="primary"
          size="compact"
          onClick={() => void confirm()}
          disabled={save.pending || !filled}
        >
          {buildShelvesCopy('rename')}
        </Button>
      </DialogActions>
    </div>
  )
}
