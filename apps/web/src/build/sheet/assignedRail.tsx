import { containerOf } from 'game-domain/container'
import type { SheetKind } from 'game-domain/entityKinds'
import type { ReactNode } from 'react'
import { runWrite } from '../../lib/runWrite'
import { AssignPicker } from '../wiring/AssignPicker'
import type { AssignedSubject } from './assignedUnits.model'
import { assignedUnitsFor } from './assignedUnits.model'
import { RelatedUnits } from './RelatedUnits'
import type { SheetViewCommonProps } from './sheetViewProps.model'

/**
 * A kind sheet's Related units section (`assignedUnitsFor`, R70), each link
 * unassigned through the store and assigned through `AssignPicker`. It draws
 * in Read too, empty or not: each empty place offers Assign and + Create to a
 * viewer who may write the sheet (`liveInRead`).
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
    liveInRead = false,
  }: Pick<
    SheetViewCommonProps,
    | 'composition'
    | 'withheld'
    | 'storeState'
    | 'holds'
    | 'hrefFor'
    | 'ownerOf'
    | 'editable'
    | 'liveInRead'
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
  return <RelatedUnits {...assigned} editable={editable} writes={editable || liveInRead} />
}
