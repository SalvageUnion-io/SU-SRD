/**
 * NpcRedesignPage — `/npcs/:id/design`, the NPC designer opened on a saved
 * NPC (its sheet's "Redesign from a template", r6 B12): Template, then its
 * one page of name, stats, actions and identity, saved onto that NPC in place (`NpcRedesigner`). Every encounter of
 * the maker's that fields it takes the change (ADR-067 §1, as amended).
 *
 * Only its maker redesigns it, and only one designed as any NPC: a crawler's
 * crew take their stats from their slot, on the crew board. Anyone else is
 * shown why, with the way back to the sheet.
 */

import { GameDataGate } from '../../components/GameDataGate'
import { Button, Callout, ChapterBand, Text } from '../../components/index'
import { RoutePending } from '../../components/shared/RouteFallbacks'
import { isRedesignable } from '../../lib/npcs/npcModel'
import { areaTitle } from '../../lib/pageTitle'
import { useTabTitle } from '../../lib/useTabTitle'
import { npcCopy } from '../../messages/build-npc'
import { sharedCopy } from '../../messages/components-shared'
import { routesCopy } from '../../messages/routes'
import { SheetFallback } from '../sheet/SheetFallback'
import { useLocatedSheet } from '../sheet/useLocatedSheet'
import { NpcRedesigner } from './AnyNpcDesigner'
import { EYEBROW, EYEBROW_LABEL, PAGE } from './npcStyles.model'

export function NpcRedesignPage({
  id,
  onSaved,
  onCancel,
}: {
  id: string
  /** The redesign was saved: back to the sheet. */
  onSaved: (npcId: string) => void
  onCancel: () => void
}) {
  const { status, held, me, crew } = useLocatedSheet('npc', id)
  useTabTitle(
    held ? areaTitle(routesCopy('mediatorsKit'), npcCopy('redesign', { name: held.name })) : null
  )

  if (status !== 'yours' || held === null) {
    // A crewmate's NPC is read on its sheet; its design is its maker's.
    return (
      <SheetFallback
        kind="npc"
        status={status === 'yours' ? 'loading' : status === 'listed' ? 'missing' : status}
        back={crew}
      />
    )
  }
  return (
    <main style={PAGE}>
      <ChapterBand
        tone="denizen"
        // The designer is a wizard, whose step title is the page's h1 (WizShell).
        as="p"
        measure="80rem"
        eyebrow={
          <p className={EYEBROW_LABEL} style={EYEBROW}>
            {npcCopy('denizensEditDesign')}
          </p>
        }
        aside={
          <Button href={`/npcs/${id}`} back variant="ink" size="compact">
            {npcCopy('backToTheSheet')}
          </Button>
        }
      >
        {npcCopy('redesign', { name: held.name })}
      </ChapterBand>
      {isRedesignable(held) ? (
        <GameDataGate fallback={<RoutePending label={sharedCopy('referenceData')} />}>
          {/* Keyed by the NPC: another one's form never carries over. */}
          <NpcRedesigner
            key={id}
            npc={held}
            madeBy={me?.displayName ?? 'you'}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        </GameDataGate>
      ) : (
        <Callout role="note">
          <Text>{npcCopy('crewDesignIsTheSlots')}</Text>
        </Callout>
      )}
    </main>
  )
}
