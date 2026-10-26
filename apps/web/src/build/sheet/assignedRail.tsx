import { containerOf } from 'game-domain/container'
import type { SheetKind } from 'game-domain/entityKinds'
import type { ReactNode } from 'react'
import { runWrite } from '../../lib/runWrite'
import { AssignPicker } from '../wiring/AssignPicker'
import { AssignedUnits } from './AssignedUnits'
import type { AssignedSubject } from './assignedUnits.model'
import { assignedUnitsFor, hasAssignedUnits } from './assignedUnits.model'
import type { SheetViewCommonProps } from './sheetViewProps.model'

/**
 * A kind sheet's Assigned units section (`assignedUnitsFor`), each link
 * unassigned through the store and assigned through `AssignPicker`. Nothing
 * linked in Read draws no section, so none reaches the sidebar either: an
 * empty sidebar would hold its column open.
 */
export function assignedRail(
  subject: AssignedSubject,
  {
    composition,
    withheld,
    storeState,
    holds,
    hrefFor,
    ownerOf,
    editable,
  }: Pick<
    SheetViewCommonProps,
    'composition' | 'withheld' | 'storeState' | 'holds' | 'hrefFor' | 'ownerOf' | 'editable'
  >,
  /** What stands in for an empty place of one kind (a pilot's mock crawler level). */
  extra?: Partial<Record<SheetKind, ReactNode>>
): ReactNode {
  const self = { type: subject.kind, id: subject.entity.id }
  const container = containerOf(subject.entity)
  const assigned = assignedUnitsFor({
    subject,
    composition,
    withheld,
    softLinks: storeState.softLinks,
    holds,
    hrefFor,
    ownerOf,
    editable,
    unassign: (linkId) => runWrite(() => storeState.delete('softLink', linkId)),
    picker: (pick, options) => (
      <AssignPicker subject={self} container={container} pick={pick} {...options} />
    ),
    ...(extra ? { extra } : {}),
  })
  return hasAssignedUnits(assigned.units, editable) ? (
    <AssignedUnits {...assigned} editable={editable} />
  ) : undefined
}
