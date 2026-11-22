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
 * It leaves the player where they asked (the mech they are tuning, the
 * builder), with a notice that opens the pattern (r4 E19), and a name a
 * pattern of theirs already has is asked about once before a second is saved
 * under it (r4 E13).
 *
 * Under the two fields, above the loadout's rules cards, it says what the
 * pattern uses and costs (`PatternTotals`): its chassis, slots filled of the
 * chassis's, and Scrap, a count over its cap marked; the Save button sits
 * with it. Damage, Heat and cargo stay on the mech (`patternFromMech`).
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { DialogActions, FieldError } from '../../../components/app'
import {
  Button,
  Input,
  ModalShell,
  PatternListing,
  Text,
  Textarea,
  tokens,
} from '../../../components/index'
import { useGo } from '../../../components/shared/useGo'
import { useServerAction } from '../../../lib/connection/useServerAction'
import { madeToast } from '../../../lib/copiedToast'
import {
  asReferencePattern,
  patternChassis,
  patternFromMech,
  savedPatternHref,
} from '../../../lib/patterns/patterns'
import { mechCopy } from '../../../messages/build-mech'
import { usePatterns } from '../../../replica/collections'
import { patternNameTaken } from './buildConfirm.model'
import { PatternTotals } from './PatternTotals'

/** What a pattern is cut from: a mech's name, chassis and loadout. */
export type PatternSource = Pick<Mech, 'name' | 'chassisRef' | 'systems' | 'modules'>

type SavePatternDialogProps = {
  source: PatternSource
  open: boolean
  onOpenChange: (open: boolean) => void
  /** After the write lands. */
  onSaved?: ((patternId: string) => void) | undefined
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

export function SavePatternDialog({ source, open, onOpenChange, onSaved }: SavePatternDialogProps) {
  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={mechCopy('saveAsPattern')}
      width="default"
    >
      {/* Mounted only while open, so every opening starts from the mech's name. */}
      {open && (
        <SavePatternBody source={source} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      )}
    </ModalShell>
  )
}

function SavePatternBody({
  source,
  onClose,
  onSaved,
}: {
  source: PatternSource
  onClose: () => void
  onSaved: SavePatternDialogProps['onSaved']
}) {
  const go = useGo()
  const [name, setName] = useState(source.name)
  const [description, setDescription] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  // The name a second pattern was asked about: Save under it again is the yes.
  const [asked, setAsked] = useState<string | null>(null)
  // The names already saved, for the ask; a no-op where they have arrived.
  useEffect(() => void usePatterns.getState().hydrate(), [])
  const save = useServerAction(
    (patternName: string) =>
      usePatterns
        .getState()
        .create(patternFromMech(source, { name: patternName, notes: description })),
    { failure: mechCopy('patternNotSaved') }
  )
  const chassis = patternChassis(source)
  const error = invalid ?? save.error

  async function confirm() {
    if (!name.trim()) {
      setInvalid(mechCopy('patternNeedsName'))
      return
    }
    setInvalid(null)
    const wanted = name.trim()
    if (asked !== wanted && patternNameTaken(wanted, usePatterns.getState().mechPatterns)) {
      setAsked(wanted)
      return
    }
    const result = await save.run(name)
    if (!result.ok) return
    onClose()
    const { id } = result.value
    madeToast(
      mechCopy('savedPattern', { name: result.value.name }),
      mechCopy('openThePattern'),
      {
        href: savedPatternHref(id),
        exists: () => usePatterns.getState().mechPatterns.some((held) => held.id === id),
      },
      go
    )
    onSaved?.(id)
  }
  const asking = asked !== null && asked === name.trim()

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

  // What is being saved, in figures (its chassis, slots and Scrap, r2 G4), and the
  // button that saves it: above the rules cards, so neither is a scroll away (r3 L5).
  const summary = (
    <div style={BODY}>
      <PatternTotals unit={source} />
      <Text variant="hint">{mechCopy('damageHeatAndCargoStay')}</Text>
      {error && <FieldError>{error}</FieldError>}
      {asking && (
        <Text variant="body" role="status">
          {mechCopy('saveAsASecondPattern', { name: asked })}
        </Text>
      )}
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
          {save.pending
            ? mechCopy('saving')
            : asking
              ? mechCopy('saveASecond')
              : mechCopy('savePattern')}
        </Button>
      </DialogActions>
    </div>
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
          edit={{ name: nameField, description: descriptionField, summary }}
        />
      ) : (
        // A chassis the reference no longer has: the two fields, without the listing.
        <>
          {nameField}
          {descriptionField}
          {summary}
        </>
      )}
    </div>
  )
}
