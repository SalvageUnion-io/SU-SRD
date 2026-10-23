/**
 * SavePatternDialog — save a mech's chassis and loadout as a pattern, over
 * the screen it was asked from: the mech sheet's More actions, a
 * Hangar shelf's menu, the builder's review.
 *
 * It shows the pattern as a chassis page lists its patterns (`PatternListing`)
 * — the HOMEBREW stamp beside its name, its loadout under it — with the two
 * things a player writes in Edit: the name, in its cut-out, and the
 * description, where a book pattern's prose goes. Saving keeps it to its
 * maker; they share it from its page or their Hangar, as every player thing.
 *
 * Damage, Heat and cargo stay on the mech (`patternFromMech`).
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import {
  Button,
  DialogActions,
  FieldError,
  Input,
  ModalShell,
  PatternListing,
  Text,
  Textarea,
  toast,
  tokens,
} from '../../../components/index'
import { useGo } from '../../../components/shared/useGo'
import { useServerAction } from '../../../lib/connection/useServerAction'
import {
  asReferencePattern,
  patternChassis,
  patternFromMech,
  patternHref,
} from '../../../lib/patterns/patterns'
import { mechCopy } from '../../../messages/build-mech'
import { usePatternStore } from '../../../stores/patternStore'

/** What a pattern is cut from: a mech's name, chassis and loadout. */
export type PatternSource = Pick<Mech, 'name' | 'chassisRef' | 'systems' | 'modules'>

type SavePatternDialogProps = {
  source: PatternSource
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * After the write lands. Absent, the player is taken to the pattern's page,
   * where they can share it.
   */
  onSaved?: ((patternId: string) => void) | undefined
  /** Stay where the dialog was opened once it lands: the builder, mid-build. */
  stay?: boolean
}

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

/** The name's field fills the cut-out, at the name's own size. */
const NAME_FIELD = {
  font: 'inherit',
  minWidth: '12rem',
  textTransform: 'inherit',
  width: '100%',
} satisfies CSSProperties

const DESCRIPTION_FIELD = { width: '100%' } satisfies CSSProperties

export function SavePatternDialog({
  source,
  open,
  onOpenChange,
  onSaved,
  stay = false,
}: SavePatternDialogProps) {
  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={mechCopy('saveAsPattern')}
      width="default"
    >
      {/* Mounted only while open, so every opening starts from the mech's name. */}
      {open && (
        <SavePatternBody
          source={source}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
          stay={stay}
        />
      )}
    </ModalShell>
  )
}

function SavePatternBody({
  source,
  onClose,
  onSaved,
  stay,
}: {
  source: PatternSource
  onClose: () => void
  onSaved: SavePatternDialogProps['onSaved']
  stay: boolean
}) {
  const go = useGo()
  const [name, setName] = useState(source.name)
  const [description, setDescription] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const save = useServerAction(
    (patternName: string) =>
      usePatternStore
        .getState()
        .create(patternFromMech(source, { name: patternName, notes: description })),
    { failure: 'The pattern could not be saved. Try again.' }
  )
  const chassis = patternChassis(source)
  const error = invalid ?? save.error

  async function confirm() {
    if (!name.trim()) {
      setInvalid('A pattern needs a name.')
      return
    }
    setInvalid(null)
    const result = await save.run(name)
    if (!result.ok) return
    onClose()
    toast.success(mechCopy('savedPattern', { name: result.value.name }))
    onSaved?.(result.value.id)
    if (!stay) go(patternHref(result.value.id))
  }

  const nameField = (
    <Input
      aria-label={mechCopy('patternName')}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void confirm()
      }}
      style={NAME_FIELD}
      required
    />
  )
  const descriptionField = (
    <Textarea
      aria-label={mechCopy('patternDescription')}
      placeholder={mechCopy('whatItIsForAnd')}
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      rows={3}
      style={DESCRIPTION_FIELD}
    />
  )

  return (
    <div style={BODY}>
      {chassis ? (
        <PatternListing
          chassis={chassis}
          chassisName={chassis.name}
          pattern={asReferencePattern({ ...source, name: name.trim() || source.name })}
          host={{ hostDown: false, chassisName: chassis.name }}
          homebrew
          edit={{ name: nameField, description: descriptionField }}
        />
      ) : (
        // A chassis the reference no longer has: the two fields, without the listing.
        <>
          {nameField}
          {descriptionField}
        </>
      )}
      <Text variant="hint">{mechCopy('damageHeatAndCargoStay')}</Text>
      {error && <FieldError>{error}</FieldError>}
      <DialogActions>
        <Button variant="ghost" size="compact" onClick={onClose} disabled={save.pending}>
          {mechCopy('cancel')}
        </Button>
        <Button
          variant="primary"
          size="compact"
          onClick={() => void confirm()}
          disabled={save.pending || !name.trim()}
        >
          {save.pending ? mechCopy('saving') : mechCopy('savePattern')}
        </Button>
      </DialogActions>
    </div>
  )
}
