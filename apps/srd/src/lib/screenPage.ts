/**
 * The Mediator Screen's data (`/screen/`): the tables a Mediator reaches for
 * mid-session, gathered onto one page as the Quick Reference Sheet sets them
 * on its first page: Core Mechanic, Group Initiative and the distances,
 * Critical Injury and Critical Damage, Heat and Reactor Overload, Area and
 * Mech Salvage, the NPC tables, and the Downtime procedure.
 *
 * Everything is read from the dataset at build time, so the screen prints the
 * book's words and its page numbers, never a paraphrase. An entry the dataset
 * no longer has is left off rather than drawn empty.
 */

import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { rollTablePageData } from '../components/RollTablePage'
import { itemHref, schemaHref } from './entityHref'
import type { RefText, RollTablePageData } from './rollTablePage'
import { refText } from './rollTablePage'
import { resolveMentionRef } from './staticLinks'

/** The screen's URL. */
export const SCREEN_HREF = '/screen/'

/** What every panel on the screen carries: its Quick Ref section, its page and where it links. */
type ScreenPanelBase = {
  /** A stable id for the panel's heading (`aria-labelledby`). */
  id: string
  /** The Quick Ref's section heading over it ("Damage", "NPC tables"). */
  section: string
  title: string
  /** The entry's own page on this site. */
  href: string
  /** The Workshop Manual page it cites. */
  page: number
}

/** A d20 table, rolled where it sits. */
export type ScreenTable = ScreenPanelBase & { kind: 'table'; data: RollTablePageData }

/** One line of a reference panel: a term and its rule ("Close" and what Close Range means). */
export type ScreenNote = { term: string; text: RefText }

/** A procedure's steps, under the heading the book sets them in ("Post-Session"). */
export type ScreenSteps = { heading: string; names: string[] }

/** A reference panel: rules to read, not roll (Heat, the distances, Downtime). */
export type ScreenReference = ScreenPanelBase & {
  kind: 'reference'
  notes: ScreenNote[]
  steps: ScreenSteps[]
}

export type ScreenPanel = ScreenTable | ScreenReference

type Block = { type?: string; value?: unknown }

/** The prose of a block list, as plain paragraphs. */
function paragraphs(content: unknown): string[] {
  if (!Array.isArray(content)) return []
  return (content as Block[]).flatMap((block) =>
    block.type === 'paragraph' && typeof block.value === 'string' ? [block.value] : []
  )
}

/** A guide's named step. */
type GuideStep = { name: string; section?: string; content?: unknown }

function stepsOf(entity: SURefEntity): GuideStep[] {
  return 'steps' in entity && Array.isArray(entity.steps) ? (entity.steps as GuideStep[]) : []
}

function contentOf(entity: SURefEntity): unknown {
  return 'content' in entity ? entity.content : undefined
}

function find(schema: SURefEnumSchemaName, name: string): SURefEntity | undefined {
  return SalvageUnionReference.getByNameIn(schema, name) as SURefEntity | undefined
}

function pageOf(entity: SURefEntity): number {
  return 'page' in entity && typeof entity.page === 'number' ? entity.page : 0
}

function idFor(title: string): string {
  return `screen-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

const prose = (text: string): RefText => refText(text, resolveMentionRef)

function table(section: string, name: string): ScreenPanel[] {
  const entity = find('roll-tables', name)
  const data = entity ? rollTablePageData(entity) : null
  if (!entity || !data) return []
  return [
    {
      kind: 'table',
      id: idFor(name),
      section,
      title: name,
      href: itemHref('roll-tables', getEntitySlug(entity)),
      page: pageOf(entity),
      data,
    },
  ]
}

function guide(section: string, title: string, entity: SURefEntity) {
  return {
    kind: 'reference' as const,
    id: idFor(title),
    section,
    title,
    href: itemHref('guides', getEntitySlug(entity)),
    page: pageOf(entity),
  }
}

/**
 * Heat (Workshop Manual p.234): the Heat Capacity rule, the Heat Check and
 * venting, each in the guide's own words.
 */
function heat(): ScreenPanel[] {
  const entity = find('guides', 'Heat')
  if (!entity) return []
  const step = (name: string) => stepsOf(entity).find((s) => s.name === name)
  const notes: ScreenNote[] = []
  const capacity = paragraphs(contentOf(entity))[1]
  if (capacity) notes.push({ term: 'Heat Capacity', text: prose(capacity) })
  const check = paragraphs(step('Heat Check')?.content).slice(0, 2)
  if (check.length > 0) notes.push({ term: 'Heat Check', text: prose(check.join(' ')) })
  const vent = paragraphs(step('Venting Heat')?.content)[0]
  if (vent) notes.push({ term: 'Venting Heat', text: prose(vent) })
  return [{ ...guide('Heat', 'Heat', entity), notes, steps: [] }]
}

/** The four ranges (Workshop Manual p.237), each by its first paragraph. */
function distances(): ScreenPanel[] {
  const ranges = SalvageUnionReference.findAllIn('distances', () => true) as SURefEntity[]
  const first = ranges[0]
  if (!first) return []
  const notes = ranges.flatMap((range): ScreenNote[] => {
    const text = paragraphs(contentOf(range))[0]
    return text ? [{ term: range.name, text: prose(text) }] : []
  })
  return [
    {
      kind: 'reference',
      id: idFor('Distances'),
      section: 'Action scene',
      title: 'Distances',
      href: schemaHref('distances'),
      page: pageOf(first),
      notes,
      steps: [],
    },
  ]
}

/**
 * The Downtime procedure (Workshop Manual p.227): its steps in order, under
 * the Post-Session and Pre-Session headings the guide sets them in. A step
 * with no section of its own continues the one above it.
 */
function downtime(): ScreenPanel[] {
  const entity = find('guides', 'Crawler Downtime')
  if (!entity) return []
  const steps: ScreenSteps[] = []
  for (const step of stepsOf(entity)) {
    const last = steps.at(-1)
    if (step.section || !last) steps.push({ heading: step.section ?? '', names: [step.name] })
    else last.names.push(step.name)
  }
  return [{ ...guide('Downtime', 'Downtime', entity), notes: [], steps }]
}

/**
 * Every panel on the screen, in the Quick Ref's order: Core Resolution, the
 * Action Scene, Damage, Heat, Salvaging, the NPC tables, then Downtime.
 */
export function screenPanels(): ScreenPanel[] {
  return [
    ...table('Core resolution', 'Core Mechanic'),
    ...table('Action scene', 'Group Initiative'),
    ...distances(),
    ...table('Damage', 'Critical Injury'),
    ...table('Damage', 'Critical Damage'),
    ...heat(),
    ...table('Heat', 'Reactor Overload'),
    ...table('Salvaging', 'Area Salvage'),
    ...table('Salvaging', 'Mech Salvage'),
    ...table('NPC tables', 'Reaction Roll'),
    ...table('NPC tables', 'NPC Action'),
    ...table('NPC tables', 'Morale'),
    ...table('NPC tables', 'Retreat'),
    ...downtime(),
  ]
}
