/**
 * BlankChassisPick — the Blank Mech dialog's chassis: every chassis in the
 * one Ledger picker (ledger.md L7), a Tech Level and its figures a row, with
 * a search over the 51 names. Nothing picked is a mech with no chassis yet,
 * decided on the sheet.
 */

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { RefChassis } from 'salvageunion-reference'
import { byTechLevelThenName, nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { SearchField, tokens } from '../../components/index'
import { readReference } from '../../lib/readReference'
import { buildWizardCopy } from '../../messages/build-wizard'
import { CHASSIS_COLUMNS } from '../mech/chassisColumns.model'
import { PickList } from './PickList'
import type { PickColumn } from './pickLedger.model'

const TECH_LEVEL: PickColumn<RefChassis> = {
  key: 'tl',
  label: buildWizardCopy('tl3'),
  title: buildWizardCopy('techLevel'),
  phone: true,
  value: (c) => c.techLevel,
}
/** A dialog's width holds the Tech Level and the four figures a build starts from. */
const KEPT = new Set(['sv', 'sp', 'ep', 'sys', 'mod'])
const COLUMNS = [TECH_LEVEL, ...CHASSIS_COLUMNS.filter((column) => KEPT.has(column.key))]

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties
/** The list scrolls in the dialog; the search and the actions stay in reach. */
const LIST = { maxHeight: '40dvh', overflowY: 'auto' } satisfies CSSProperties

export function BlankChassisPick({
  value,
  onChange,
}: {
  /** The picked chassis's slug; '' while none is. */
  value: string
  onChange: (slug: string) => void
}) {
  const [query, setQuery] = useState('')
  const all = useMemo(
    () =>
      readReference(
        'BlankChassisPick.chassis',
        () => [...SalvageUnionReference.Chassis.all()].sort((a, b) => byTechLevelThenName(a, b)),
        []
      ),
    []
  )
  const needle = query.trim().toLowerCase()
  const rows = needle === '' ? all : all.filter((c) => c.name.toLowerCase().includes(needle))
  return (
    // `.su-sheet--mech` gives the picker its band's tone, as the wizard's has.
    <div className="su-sheet--mech" style={COLUMN}>
      <SearchField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={buildWizardCopy('searchChassis')}
        aria-label={buildWizardCopy('searchChassis')}
        autoComplete="off"
      />
      <div style={LIST}>
        <PickList
          title={buildWizardCopy('chassis')}
          note={buildWizardCopy('optionalDecideOnTheSheet')}
          rows={rows}
          rowKey={(c) => nameToSlug(c.name)}
          rowName={(c) => c.name}
          columns={COLUMNS}
          selected={value || undefined}
          onSelect={onChange}
        />
      </div>
    </div>
  )
}
