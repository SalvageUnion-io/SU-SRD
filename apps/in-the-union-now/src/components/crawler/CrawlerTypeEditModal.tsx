/**
 * CrawlerTypeEditModal — the live sheet's inline "Change crawler type" picker
 * (build-edit mode). Reuses the wizard's master-detail type step
 * (CrawlerTypeOptionList + CrawlerTypeDetail) inside a ModalShell.
 *
 * A type change is DESTRUCTIVE and stateful: it resets the crawler's special
 * type NPC to the new type's default, drops the orphaned old type's Keepsake/
 * Motto selections, and leaves every bay's live state untouched — the exact
 * multi-write the wizard's edit branch performs, via the shared
 * applyCrawlerCrewAndTypeEdit helper. A confirm step guards the change.
 */

import { useEffect, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefCrawler } from 'salvageunion-reference'
import { Btn, ModalShell, toast } from 'suref-react'

import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityState } from '../../stores/entityStore'
import {
  EMPTY_CRAWLER_FORM_STATE,
  type CrawlerWizardFormState,
} from '../../lib/wizard/crawlerFormState'
import { applyCrawlerCrewAndTypeEdit } from '../../lib/wizard/applyCrawlerEdit'
import { ConfirmDialog } from 'suref-react'
import { CrawlerTypeDetail, CrawlerTypeOptionList } from './CrawlerTypeStep'

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
        subtitle="Resets the special NPC · keeps bays and their crew"
      >
        <div className="flex flex-col gap-4 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="max-h-[50vh] overflow-y-auto">
              <CrawlerTypeOptionList types={types} selectedType={selected} onSelect={setSelected} />
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              <CrawlerTypeDetail selected={selectedEntity} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              size="sm"
              disabled={!changed}
              onClick={() => setConfirming(true)}
            >
              Change Type…
            </Btn>
          </div>
        </div>
      </ModalShell>

      {/* Destructive-change confirm — shared ConfirmDialog, like the mech pickers. */}
      <ConfirmDialog
        open={confirming && changed}
        title="Change crawler type?"
        confirmLabel="Change Type"
        pendingLabel="Changing…"
        pending={busy}
        danger
        onConfirm={() => void applyChange()}
        onCancel={() => setConfirming(false)}
      >
        Change to <strong>{selectedEntity?.name}</strong>? This resets the crawler's special NPC to
        the new type's default (its name, description and HP are cleared) and drops the old type's
        Keepsake/Motto. Your bays and their crew are kept.
      </ConfirmDialog>
    </>
  )
}
