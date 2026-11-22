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
 * under it (r4 E13); beside that, Replace writes this build over the one that
 * has the name, which keeps its link and its description (r5 D1), and the
 * notice's Undo puts its old build back.
 *
 * Under the two fields, above the loadout's rules cards, it says what the
 * pattern uses and costs (`PatternTotals`): its chassis, slots filled of the
 * chassis's, and Scrap, a count over its cap marked; the Save button sits
 * with it. Damage, Heat and cargo stay on the mech (`patternFromMech`).
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties, Ref } from 'react'
import { useEffect, useRef, useState } from 'react'
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
import { LIVE_SHEET_MANUAL } from '../../../replica/provenance'
import { useUnits } from '../../../replica/units'
import { patternNameTaken, patternToReplace, replacePattern } from './buildConfirm.model'
import { PatternTotals } from './PatternTotals'

/** What a pattern is cut from: a mech's name, chassis and loadout. */
export type PatternSource = Pick<Mech, 'name' | 'chassisRef' | 'systems' | 'modules'> & {
  /** The saved pattern the mech was built from: the one a Replace under its name means. */
  sourcePattern?: string | undefined
  /**
   * The mech's own id, where it is one already (its sheet, a shelf row): the
   * pattern saved from it becomes the pattern it is linked to (r6 E1), so its
   * band names it at once and its drift reads against it.
   */
  id?: string | undefined
}

/** Link the mech the pattern was cut from to it (r6 E1); a failed write leaves the pattern saved. */
function linkSource(source: PatternSource, patternId: string) {
  const mechId = source.id
  if (mechId === undefined || source.sourcePattern === patternId) return
  void useUnits
    .getState()
    .update('mech', mechId, { sourcePattern: patternId }, LIVE_SHEET_MANUAL)
    .catch(() => undefined)
}

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
  // Typing starts in the name, never on Close (r4 E14).
  const nameRef = useRef<HTMLInputElement | null>(null)
  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={mechCopy('saveAsPattern')}
      width="default"
      initialFocus={nameRef}
    >
      {/* Mounted only while open, so every opening starts from the mech's name. */}
      {open && (
        <SavePatternBody
          source={source}
          nameRef={nameRef}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      )}
    </ModalShell>
  )
}

function SavePatternBody({
  source,
  nameRef,
  onClose,
  onSaved,
}: {
  source: PatternSource
  nameRef: Ref<HTMLInputElement>
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
  const held = usePatterns((s) => s.mechPatterns)
  const replace = useServerAction((id: string) => replacePattern(id, source), {
    failure: mechCopy('patternNotReplaced'),
  })
  const chassis = patternChassis(source)
  const error = invalid ?? save.error ?? replace.error
  const pending = save.pending || replace.pending

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
    const saved = result.value.name
    // The line names the pattern as it is called now (r5 C3).
    const nameNow = () =>
      usePatterns.getState().mechPatterns.find((held) => held.id === id)?.name ?? saved
    madeToast(
      () => mechCopy('savedPattern', { name: nameNow() }),
      mechCopy('openThePattern'),
      {
        href: savedPatternHref(id),
        exists: () => usePatterns.getState().mechPatterns.some((held) => held.id === id),
      },
      go
    )
    linkSource(source, id)
    onSaved?.(id)
  }
  const asking = asked !== null && asked === name.trim()
  // The pattern a Replace would write over: the mech's own of that name, else the only one.
  const replaceable = asking ? patternToReplace(asked, held, source.sourcePattern) : undefined

  async function confirmReplace(id: string) {
    const result = await replace.run(id)
    if (!result.ok) return
    onClose()
    linkSource(source, id)
    onSaved?.(id)
  }

  const nameField = (
    <Input
      ref={nameRef}
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
          {replaceable
            ? mechCopy('replaceOrSaveASecond', { name: asked })
            : mechCopy('saveAsASecondPattern', { name: asked })}
        </Text>
      )}
      <DialogActions>
        <Button variant="ghost" size="compact" onClick={onClose} disabled={pending}>
          {mechCopy('cancel')}
        </Button>
        {replaceable && (
          <Button
            size="compact"
            onClick={() => void confirmReplace(replaceable.id)}
            disabled={pending}
          >
            {replace.pending
              ? mechCopy('replacing')
              : mechCopy('replaceNamed', { name: replaceable.name })}
          </Button>
        )}
        <Button
          variant="primary"
          size="compact"
          onClick={() => void confirm()}
          disabled={pending || !name.trim()}
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
