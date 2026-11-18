// MOCK (Working Manual, A): a chassis page's patterns as a table to compare,
// one row per pattern, in place of the full pattern rows. Not shipped code.
import type { RefObjectAnyPattern } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { Badge } from '../../atoms/Badge'
import { InlineRef } from '../../atoms/InlineRef'
import { Box } from '../../containers/Box'
import { isLegalStartingPatternOf } from './legalStartingPattern'
import { usePatternHref } from './PatternListRow'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'

/** "Workshop Manual p.101": the book's name less the game's. */
function citeOf(pattern: RefObjectAnyPattern): string {
  const book = 'source' in pattern && pattern.source ? String(pattern.source) : ''
  const page = 'page' in pattern && pattern.page != null ? ` p.${pattern.page}` : ''
  return `${book.replace(/^Salvage Union /, '')}${page}`
}

type Named = { name: string; quantity?: number }

/** A loadout as running text: "Escape Hatch, Rigging Arm ×2". */
function namesOf(list: unknown): string {
  if (!Array.isArray(list)) return ''
  return (list as Named[])
    .map((entry) =>
      entry.quantity && entry.quantity > 1 ? `${entry.name} ×${entry.quantity}` : entry.name
    )
    .join(', ')
}

function PatternTableRow({
  chassis,
  pattern,
}: {
  chassis: ReferenceCardEntity
  pattern: RefObjectAnyPattern
}) {
  const href = usePatternHref(chassis, pattern)
  const name = normalizePatternName(pattern.name)
  const systems = namesOf('systems' in pattern ? pattern.systems : undefined)
  const modules = namesOf('modules' in pattern ? pattern.modules : undefined)
  return (
    <tr>
      <th scope="row" className="su-mock-table__name">
        <InlineRef href={href}>{name}</InlineRef>
        {isLegalStartingPatternOf(pattern) && (
          <Badge shape="stamp" size="mini" surface="solid">
            Starting
          </Badge>
        )}
      </th>
      <td data-label="Systems">{systems || '—'}</td>
      <td data-label="Modules">{modules || '—'}</td>
      <td data-label="Source" className="su-mock-table__cite">
        {citeOf(pattern)}
      </td>
    </tr>
  )
}

export function PatternTable({
  chassis,
  patterns,
}: {
  chassis: ReferenceCardEntity
  patterns: RefObjectAnyPattern[]
}) {
  return (
    <Box frameColor="var(--color-ink)" body="flush">
      <table className="su-mock-table su-mock-table--stack">
        <thead>
          <tr>
            <th scope="col">Pattern</th>
            <th scope="col">Systems</th>
            <th scope="col">Modules</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {patterns.map((pattern) => (
            <PatternTableRow key={pattern.name} chassis={chassis} pattern={pattern} />
          ))}
        </tbody>
      </table>
    </Box>
  )
}
