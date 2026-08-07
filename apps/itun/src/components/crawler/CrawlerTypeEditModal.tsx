/**
 * CrawlerTypeEditModal — the live sheet's inline "Change crawler type" picker
 * (build-edit mode). Uses the shared `EntitySearcher` in a bare ModalShell, the
 * same picker every other "choose a reference entity" modal runs on; it
 * previously ran the wizard's master/detail type panes, whose narrow option
 * rail clipped these large cards (see MechChassisPickerModal for the same fix).
 *
 * A type change is DESTRUCTIVE and stateful: it resets the crawler's special
 * type NPC to the new type's default, drops the orphaned old type's Keepsake/
 * Motto selections, and leaves every bay's live state untouched — the exact
 * multi-write the wizard's edit branch performs, via the shared
 * applyCrawlerCrewAndTypeEdit helper. A confirm step guards the change.
 */

import { Button, EntitySearcher, ModalShell, toast } from 'component-lib'
import { useEffect, useState } from 'react'
import type { SURefCrawler } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Crawler } from '../../lib/schemas/crawler'
import { applyCrawlerCrewAndTypeEdit } from '../../lib/wizard/applyCrawlerEdit'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import { EMPTY_CRAWLER_FORM_STATE } from '../../lib/wizard/crawlerFormState'
import type { EntityState } from '../../stores/entityStore'

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
  const [types, setTypes] = useState<SURefCrawler[]>([])
  const [selected, setSelected] = useState<string | null>(crawler.type ?? null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void SalvageUnionReference.preload(['crawlers', 'crawler-bays']).then(() => {
      setTypes(SalvageUnionReference.Crawlers.all())
    })
  }, [])

  // Reset the picker to the crawler's current type each time it opens. Depends
  // on `open` ONLY: the atomic type write flips crawler.type as it completes, so
  // depending on it here would reset busy/confirming mid-write (a UI flicker).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open only, by design
  useEffect(() => {
    if (open) {
      setSelected(crawler.type ?? null)
      setConfirming(false)
      setBusy(false)
    }
  }, [open])

  const currentType = crawler.type ?? null
  const changed = selected !== null && selected !== currentType
  const selectedEntity = types.find((t) => t.id === selected)

  async function applyChange() {
    if (!selected || !changed) return
    setBusy(true)
    try {
      // One atomic multi-write: the new type field + reset typeNpc + drop the
      // old type's orphaned bayChoices key, all in a single record update (crew
      // is empty here — bays' live state is untouched). Passing the type into
      // the helper means no separate pre-write that could half-apply.
      const form: CrawlerWizardFormState = {
        ...EMPTY_CRAWLER_FORM_STATE,
        type: selected,
        crew: {},
      }
      await applyCrawlerCrewAndTypeEdit(storeState, crawler.id, form, currentType, types, selected)

      toast.success(`Changed crawler type to ${selectedEntity?.name ?? 'new type'}.`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change crawler type.')
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <>
      <ModalShell
        open={open && !confirming}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        title="Change Crawler Type"
        maxWidth="max-w-5xl"
        bare
      >
        <EntitySearcher
          schema="crawlers"
          mode="single"
          selected={selected ? [selected] : []}
          // Single-select: picking replaces the prior pick, picking the current
          // one clears it (the confirm button then disables).
          onToggle={(ref) => setSelected((prev) => (prev === ref ? null : ref))}
          // The crawler record stores its type by reference-entity ID, so that
          // is the identity this picker has to emit.
          idOf={(item) => item.id}
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
                Change Type…
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
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          <div className="font-body text-sm text-wk-muted">
            Change to <strong>{selectedEntity?.name}</strong>? This resets the crawler's special NPC
            to the new type's default (its name, description and HP are cleared) and drops the old
            type's Keepsake/Motto. Your bays and their crew are kept.
          </div>
          <div className="flex justify-end gap-2">
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
              {busy ? 'Changing…' : 'Change Type'}
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
