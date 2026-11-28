/**
 * A crawler bay's crew lead on the dashboard's manifest (`CrawlerDash`): who
 * they are, and their post, which Peeks the book's crew NPC for the bay.
 */

import type { ReactNode } from 'react'
import {
  PEEK_ATTRIBUTE,
  PEEK_PRESS_ATTRIBUTE,
  usePeekAttrs,
} from '../../components/entity/peekContext'
import { InlineRef } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { Lead } from './bayLead.model'

/**
 * The lead's post, which Peeks the book's crew NPC for the bay
 * (`crawler-bays:<id>/npc`): a press opens it, as the old sheet's crew Mini did.
 */
function LeadPost({ peekAt, children }: { peekAt: string | undefined; children: ReactNode }) {
  const peek = usePeekAttrs(undefined, peekAt)
  if (!peekAt || !peek[PEEK_ATTRIBUTE]) return <>{children}</>
  return (
    // The press is the Peek's (`data-peek-press`, opened by the Peek's own
    // listener in the capture phase): the button does nothing else.
    <InlineRef onOpen={() => undefined} {...peek} {...{ [PEEK_PRESS_ATTRIBUTE]: '' }}>
      {children}
    </InlineRef>
  )
}

/** The lead's cell: their name, then their post in the book's words ("the Princeps"). */
export function LeadCell({ lead, peekAt }: { lead: Lead; peekAt?: string | undefined }) {
  if (!lead.name)
    return lead.position ? (
      <LeadPost peekAt={peekAt}>{buildSheetCopy('thePost', { post: lead.position })}</LeadPost>
    ) : null
  return (
    <>
      <b className="su-bay-lead__name">{lead.name}</b>
      {lead.position && ' '}
      {lead.position && (
        <span className="su-bay-lead__post">
          <LeadPost peekAt={peekAt}>
            {buildSheetCopy('thePostAfter', { post: lead.position })}
          </LeadPost>
        </span>
      )}
    </>
  )
}
