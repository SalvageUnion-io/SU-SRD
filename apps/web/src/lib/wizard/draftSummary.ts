/**
 * What a kept wizard draft is, in words (`wizardDraft.ts` keeps it): the pick
 * it was built on ("Hacker"), said wherever the draft is offered back — the
 * Training Bay's "Draft: Hacker pilot · Resume" line, the note on leaving a
 * wizard — and the question a "Build with this" link asks when it names a
 * different pick than the draft's (`draftConflict`): a link never reopens an
 * old draft silently, and never discards one.
 *
 * Pure but for the read of the browser's draft and the reference data.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { SalvageUnionReference } from 'salvageunion-reference'
import { buildWizardCopy } from '../../messages/build-wizard'
import { readReference } from '../readReference'
import type { CrawlerWizardFormState } from './crawlerFormState'
import type { MechWizardFormState } from './mechFormState'
import type { PilotWizardFormState } from './pilotFormState'
import { preselectedChassis, preselectedClassId, preselectedCrawlerType } from './preselect'
import { readWizardDraft, wizardDraftKey } from './wizardDraft'

const DRAFT_KINDS = ['pilot', 'mech', 'crawler'] as const satisfies readonly SheetKind[]

export type DraftSummary = {
  kind: SheetKind
  /** The draft as a line names it: "Hacker pilot", "Mule mech", or the bare kind before a pick. */
  label: string
}

/** The picks a "Build with this" link can carry, as each `/new` route parses them. */
export type DraftLinkPicks = {
  class?: string | undefined
  chassis?: string | undefined
  pattern?: string | undefined
  type?: string | undefined
}

const className = (id: string) =>
  readReference(
    'draftSummary.class',
    () => SalvageUnionReference.Classes.getById(id)?.name,
    undefined
  )
const chassisName = (slug: string) =>
  readReference(
    'draftSummary.chassis',
    () => SalvageUnionReference.Chassis.getBySlug(slug)?.name,
    undefined
  )
const crawlerName = (slug: string) =>
  readReference(
    'draftSummary.crawler',
    () => SalvageUnionReference.Crawlers.getBySlug(slug)?.name,
    undefined
  )

/** The pick a kind's stored draft was built on, by name; '' before one, null with no draft. */
function draftPick(kind: SheetKind): string | null {
  const key = wizardDraftKey(kind)
  if (kind === 'pilot') {
    const draft = readWizardDraft<Partial<PilotWizardFormState>>(key)
    return draft === null ? null : draft.classId ? (className(draft.classId) ?? '') : ''
  }
  if (kind === 'mech') {
    const draft = readWizardDraft<Partial<MechWizardFormState>>(key)
    return draft === null ? null : draft.chassisName ? (chassisName(draft.chassisName) ?? '') : ''
  }
  const draft = readWizardDraft<Partial<CrawlerWizardFormState>>(key)
  return draft === null ? null : draft.type ? (crawlerName(draft.type) ?? '') : ''
}

/** "Hacker pilot"; the bare kind while the draft has no pick. */
function labelOf(kind: SheetKind, pick: string): string {
  const noun =
    kind === 'pilot'
      ? buildWizardCopy('draftPilot')
      : kind === 'mech'
        ? buildWizardCopy('draftMech')
        : buildWizardCopy('draftCrawler')
  return pick === '' ? noun : `${pick} ${noun}`
}

/** The kind's kept draft, or null when this tab keeps none. */
export function wizardDraftSummary(kind: SheetKind): DraftSummary | null {
  const pick = draftPick(kind)
  return pick === null ? null : { kind, label: labelOf(kind, pick) }
}

/** Every draft this tab keeps, pilots first. */
export function wizardDrafts(): DraftSummary[] {
  return DRAFT_KINDS.map(wizardDraftSummary).filter((d): d is DraftSummary => d !== null)
}

/**
 * A link's pick against the kept draft's: the two by name when both are made
 * and differ ("Hacker pilot", "Scout pilot"), null when there is nothing to
 * ask (no draft, no pick on either side, the same pick). A mech's pattern on
 * the same chassis as the draft's is the same build: the wizard's own prefill
 * rule decides it (`withPatternPreselection`).
 */
export function draftConflict(
  kind: SheetKind,
  picks: DraftLinkPicks
): { draft: string; fresh: string } | null {
  const fresh =
    kind === 'pilot'
      ? className(preselectedClassId(picks.class) ?? '')
      : kind === 'mech'
        ? chassisName(preselectedChassis(picks.chassis) ?? '')
        : crawlerName(preselectedCrawlerType(picks.type) ?? '')
  const draft = draftPick(kind)
  if (!fresh || !draft || fresh === draft) return null
  return { draft: labelOf(kind, draft), fresh: labelOf(kind, fresh) }
}
