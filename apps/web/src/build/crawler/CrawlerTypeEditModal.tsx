/**
 * CrawlerTypeEditModal — the live sheet's inline "Change crawler type" picker
 * (build-edit mode). Uses the shared `EntitySearcher` in a bare ModalShell, the
 * same picker every other "choose a reference entity" modal runs on.
 *
 * A type change is DESTRUCTIVE and stateful: it resets the crawler's special
 * type NPC to the new type's default, drops the orphaned old type's Keepsake/
 * Motto selections, and leaves every bay's live state untouched — one
 * multi-write, via the applyCrawlerCrewAndTypeEdit helper. A confirm step
 * guards the change.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import { useEffect, useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import {
  Button,
  ConfirmDialog,
  EntitySearcher,
  ModalShell,
  Text,
  toast,
} from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { applyCrawlerCrewAndTypeEdit } from '../../lib/wizard/applyCrawlerEdit'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import { EMPTY_CRAWLER_FORM_STATE } from '../../lib/wizard/crawlerFormState'
import { crawlerCopy } from '../../messages/build-crawler'
import type { EntityState } from '../../stores/entityStore'
import '../../styles/build/wizard.css'

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
    // A failure is already toasted by the server action; ConfirmDialog closes
    // on return, which drops the reader back on the picker.
    if (!result.ok) return
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
        title={crawlerCopy('changeCrawlerType')}
        width="page"
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
          chosenLabel={crawlerCopy('chosen')}
          title={crawlerCopy('changeCrawlerType')}
          subtitle={crawlerCopy('resetsTheSpecialNpcKeeps')}
          emptyMessage={crawlerCopy('noMatchingCrawlerTypes')}
          onClose={onClose}
          railActions={
            <>
              <Button variant="ghost" size="compact" onClick={onClose}>
                {crawlerCopy('cancel')}
              </Button>
              <Button
                variant="primary"
                size="compact"
                disabled={!changed}
                onClick={() => setConfirming(true)}
              >
                {crawlerCopy('changeType')}
              </Button>
            </>
          }
        />
      </ModalShell>

      <ConfirmDialog
        open={confirming && changed}
        onOpenChange={setConfirming}
        title={crawlerCopy('changeCrawlerType2')}
        tone="danger"
        body={
          <Text variant="note">
            Change to <strong>{selectedEntity?.name}</strong>? This resets the crawler's special NPC
            to the new type's default (its name, description and HP are cleared) and drops the old
            type's Keepsake/Motto. Your bays and their crew are kept.
          </Text>
        }
        confirmLabel={crawlerCopy('changeType2')}
        pendingLabel={crawlerCopy('changing')}
        onConfirm={applyChange}
      />
    </>
  )
}
