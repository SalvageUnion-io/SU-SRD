/**
 * CrawlerTypeEditModal — the live sheet's inline "Change crawler type" picker
 * (build-edit mode). Uses the shared `EntitySearcher` in a bare ModalShell, the
 * same picker every other "choose a reference entity" modal runs on, so these
 * large cards are never clipped by a narrow option rail.
 *
 * A type change is DESTRUCTIVE and stateful: it resets the crawler's special
 * type NPC to the new type's default, drops the orphaned old type's Keepsake/
 * Motto selections, and leaves every bay's live state untouched — one
 * multi-write, via the applyCrawlerCrewAndTypeEdit helper. A confirm step
 * guards the change.
 */

import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { useServerAction } from '../../lib/connection/useServerAction'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { applyCrawlerCrewAndTypeEdit } from '../../lib/wizard/applyCrawlerEdit'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import { EMPTY_CRAWLER_FORM_STATE } from '../../lib/wizard/crawlerFormState'
import type { EntityState } from '../../stores/entityStore'
import { Button, EntitySearcher, ModalShell, toast, tokens } from '../index'
import '../../styles/builder/wizard.css'

/** The confirm dialog's body. */
const CONFIRM_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  backgroundColor: tokens.color.paper,
  padding: tokens.space[20],
} satisfies CSSProperties

/** The confirm dialog's consequence copy. */
const CONFIRM_COPY = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  color: tokens.color.wkMuted,
} satisfies CSSProperties

/** Cancel / confirm, right-aligned. */
const CONFIRM_ACTIONS = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: tokens.space[8],
} satisfies CSSProperties

type CrawlerTypeEditModalProps = {
  open: boolean
  onClose: () => void
  crawler: Crawler
  /** Live write surface (EntityState) for the multi-write. */
  storeState: EntityState
}

export function CrawlerTypeEditModal({
  open,
  onClose,
  crawler,
  storeState,
}: CrawlerTypeEditModalProps) {
  const [selected, setSelected] = useState<string | null>(crawler.type ?? null)
  const [confirming, setConfirming] = useState(false)
  // One atomic multi-write: the new type field + reset typeNpc + drop the old
  // type's orphaned bayChoices key, all in a single record update (crew is
  // empty here — bays' live state is untouched). Passing the type into the
  // helper means no separate pre-write that could half-apply.
  const change = useServerAction(
    (from: string | null, to: string) => {
      const form: CrawlerWizardFormState = { ...EMPTY_CRAWLER_FORM_STATE, type: to, crew: {} }
      return applyCrawlerCrewAndTypeEdit(storeState, crawler.id, form, from, to)
    },
    { failure: 'The crawler type could not be changed. Try again.', toastId: 'crawler-type' }
  )
  const busy = change.pending

  // Reset the picker to the crawler's current type each time it opens. Depends
  // on `open` ONLY: the atomic type write flips crawler.type as it completes, so
  // depending on it here would reset the confirm mid-write (a UI flicker).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open only, by design
  useEffect(() => {
    if (open) {
      setSelected(crawler.type ?? null)
      setConfirming(false)
    }
  }, [open])

  const currentType = crawler.type ?? null
  const changed = selected !== null && selected !== currentType
  const selectedEntity = selected ? resolveCrawlerType(selected) : null

  async function applyChange() {
    if (!selected || !changed) return
    const result = await change.run(currentType, selected)
    if (!result.ok) {
      setConfirming(false)
      return
    }
    toast.success(`Changed crawler type to ${selectedEntity?.name ?? 'new type'}.`)
    onClose()
  }

  return (
    <>
      <ModalShell
        open={open && !confirming}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        title="Change Crawler Type"
        maxWidth="su-wiz-modal-5xl"
        bare
      >
        <EntitySearcher
          schema="crawlers"
          mode="single"
          selected={selected ? [selected] : []}
          // Single-select: picking replaces the prior pick, picking the current
          // one clears it (the confirm button then disables).
          onToggle={(ref) => setSelected((prev) => (prev === ref ? null : ref))}
          // The crawler record stores its type as a slug.
          idOf={(item) => nameToSlug(item.name)}
          // Five types — a Tech-Level / status facet row would be chrome over a
          // list short enough to read whole.
          facets={{ status: false, techLevel: false, traits: false }}
          chosenLabel="Chosen"
          title="Change Crawler Type"
          subtitle="Resets the special NPC · keeps bays and their crew"
          emptyMessage="No matching crawler types."
          onClose={onClose}
          railActions={
            <>
              <Button variant="ghost" size="compact" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="compact"
                disabled={!changed}
                onClick={() => setConfirming(true)}
              >
                Change type…
              </Button>
            </>
          }
        />
      </ModalShell>

      {/* Destructive-change confirm — inline ModalShell, like the mech pickers. */}
      <ModalShell
        open={confirming && changed}
        onOpenChange={(next) => {
          if (!next) setConfirming(false)
        }}
        title="Change crawler type?"
        tone="danger"
        maxWidth="su-wiz-modal-md"
      >
        <div style={CONFIRM_BODY}>
          <div style={CONFIRM_COPY}>
            Change to <strong>{selectedEntity?.name}</strong>? This resets the crawler's special NPC
            to the new type's default (its name, description and HP are cleared) and drops the old
            type's Keepsake/Motto. Your bays and their crew are kept.
          </div>
          <div style={CONFIRM_ACTIONS}>
            <Button
              variant="ghost"
              size="compact"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="compact"
              onClick={() => void applyChange()}
              disabled={busy}
            >
              {busy ? 'Changing…' : 'Change type'}
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
