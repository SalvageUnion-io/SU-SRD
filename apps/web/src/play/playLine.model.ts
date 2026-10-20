/**
 * playLine.model — the Mini model of an Actions list line that is no
 * reference entity (play.md §5): the mech's Reactor, Mount, and the Downtime
 * actions the guide names (Train your Pilot, Craft · Trade, Gather Cantina
 * Rumours). Play's lists are Minis (ruleset §1.3, ADR-051 §6), so each is the
 * ink Mini of a thing you do, as an action's is, linked nowhere and Peeking
 * nothing (`synthetic`): its controls ride its chip group (R6), and what it
 * rolls is its contentful body (N3).
 */

import type { EntityFormModel } from '../components/index'

export function playLineModel({ name, key }: { name: string; key: string }): EntityFormModel {
  return {
    ref: {
      schemaName: 'actions',
      id: `synthetic/play/${key}`,
      slug: key,
      name,
      synthetic: true,
    },
    title: name,
    kind: { stamp: 'Action', type: 'Action', domain: 'action', nature: 'do' },
    tone: 'ink',
    facts: [],
    traits: [],
    art: { kind: 'none' },
  }
}
