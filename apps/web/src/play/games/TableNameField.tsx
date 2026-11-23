/** The Display name a door that makes or joins a Game asks for (r7 C1, `useTableName`). */

import { Field, Input } from '../../components/index'
import { playGamesCopy } from '../../messages/play-games'
import type { TableName } from './useTableName'

/** The Display name field itself, on the door's own form. */
export function TableNameField({
  name,
  onEnter,
}: {
  name: TableName
  /** Enter in the name presses the door's button. */
  onEnter?: () => void
}) {
  return (
    <Field label={playGamesCopy('displayName')}>
      <Input
        aria-label={playGamesCopy('displayName')}
        placeholder={playGamesCopy('displayNameExample')}
        value={name.value}
        // The account's own cap on a name (`worker/accountRoutes.ts`).
        maxLength={200}
        autoComplete="nickname"
        onChange={(e) => name.setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || onEnter === undefined) return
          e.preventDefault()
          onEnter()
        }}
      />
    </Field>
  )
}
