import {
  discordAccent,
  getEntitySlug,
  rangeLabel,
  SalvageUnionReference,
  SRD_SITE_URL,
  srdEntityUrl,
} from 'salvageunion-reference'
import type { ButtonSpec, ContainerBlock, ContainerData } from './container'
import { encodeRollRequest, makeCustomId } from './customId'

/**
 * The `/su screen` reply — pure `data → ContainerData`: the d20 tables the
 * Quick Reference Sheet gathers on its first page, each by its bands over a
 * button that rolls it. Every button is its asker's alone
 * (`encodeRollRequest`), and carries `private` through to the roll.
 */

/** The SRD's Mediator Screen. */
export const SCREEN_URL = `${SRD_SITE_URL}/screen/`

/** The tables, in the Quick Ref's sections and order. */
export const SCREEN_SECTIONS: { section: string; tables: string[] }[] = [
  { section: 'Core resolution', tables: ['Core Mechanic'] },
  { section: 'Action scene', tables: ['Group Initiative'] },
  { section: 'Damage', tables: ['Critical Injury', 'Critical Damage'] },
  { section: 'Heat', tables: ['Reactor Overload'] },
  { section: 'Salvaging', tables: ['Area Salvage', 'Mech Salvage'] },
  { section: 'NPC tables', tables: ['Reaction Roll', 'NPC Action', 'Morale', 'Retreat'] },
]

/** A band's lowest face: "11-19" → 11, "20" → 20. */
function lowFace(key: string): number {
  return Number.parseInt(key.split('-')[0] ?? '', 10)
}

/** A table's bands as one line, highest first: `20 Nailed it · 11–19 Success · …`. */
function bandLine(table: object): string {
  return Object.entries(table)
    .filter(([key]) => key !== 'type' && !Number.isNaN(lowFace(key)))
    .sort(([a], [b]) => lowFace(b) - lowFace(a))
    .map(([key, row]) => {
      const label = (row as { label?: unknown }).label
      return typeof label === 'string' ? `${rangeLabel(key)} ${label}` : rangeLabel(key)
    })
    .join(' · ')
}

/**
 * The screen as a container: a heading linked to the SRD's screen, then each
 * Quick Ref section's tables, a line apiece, over a row of roll buttons.
 * A table the dataset no longer has is left off.
 */
export function buildScreenData(ownerId: string, isPrivate: boolean): ContainerData {
  const blocks: ContainerBlock[] = [
    { kind: 'text', content: `## [Mediator Screen](${SCREEN_URL})` },
  ]

  for (const { section, tables } of SCREEN_SECTIONS) {
    const lines: string[] = []
    const buttons: ButtonSpec[] = []
    for (const name of tables) {
      const table = SalvageUnionReference.RollTables.getByName(name)
      if (!table) continue
      const url = srdEntityUrl('roll-tables', getEntitySlug(table))
      lines.push(`**[${table.name}](${url})** p.${table.page}\n${bandLine(table.table)}`)
      const customId = makeCustomId('roll', encodeRollRequest(table.name, ownerId, isPrivate))
      if (customId) buttons.push({ kind: 'action', customId, label: table.name })
    }
    if (lines.length === 0) continue
    blocks.push({ kind: 'text', content: `### ${section}\n${lines.join('\n')}` })
    if (buttons.length > 0) blocks.push({ kind: 'buttons', buttons })
  }

  blocks.push({
    kind: 'text',
    content: `-# Heat, the distances and Downtime are on the [full screen](${SCREEN_URL}).`,
  })
  return { accent: discordAccent('ink'), blocks }
}
