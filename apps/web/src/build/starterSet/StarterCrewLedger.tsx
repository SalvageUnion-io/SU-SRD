/**
 * StarterCrewLedger — a book crew (the Starter Set's by default, or the
 * Quickstart's) as ONE Ledger (ledger.md L1, L9), wherever it is listed: a
 * front door, the Starter Set page, the Training Bay's foot. A line a build:
 * its name the link to its read-only sheet (`/starter/:kind/:id`), what kind
 * of thing it is, the class or chassis it is built on (a Mention: it Peeks and
 * opens), and its Tech Level. A mixed list, so its band is ink.
 *
 * With `confirm` and a live session each line ends in its "Copy to…" menu
 * (`CopyStarterMenu`).
 */

import type { ReactNode } from 'react'
import type { LedgerColumn } from '../../components/index'
import { CiteLine, Ledger, Mention } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import type { StarterRosterId } from '../../lib/starterSet/starterTemplates'
import {
  QUICKSTART_BOOK,
  STARTER_SET_ADVENTURE,
  STARTER_SET_PUBLISHER,
  starterRoster,
} from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { CopyStarterMenu } from './CopyStarterMenu'
import type { StarterBuild } from './starterShelves.model'
import { starterShelves } from './starterShelves.model'

const COLUMNS: readonly LedgerColumn[] = [
  { key: 'kind', label: buildStarterSetCopy('kind'), kind: 'text', phone: true },
  { key: 'built-on', label: buildStarterSetCopy('builtOn'), kind: 'text', phone: true },
  {
    key: 'tech-level',
    label: buildStarterSetCopy('tl'),
    title: buildStarterSetCopy('techLevel'),
    kind: 'figure',
  },
]

/** The book each crew is printed in, for the Ledger's foot. */
const BOOK: Record<StarterRosterId, string> = {
  'starter-set': STARTER_SET_ADVENTURE,
  quickstart: QUICKSTART_BOOK,
}

/** What a build is built on, as a Mention of that entity; none draws the dash. */
function builtOn(build: StarterBuild): ReactNode {
  const source = build.relations[0]
  return source ? <Mention entityRef={source.ref}>{source.param}</Mention> : ''
}

function techLevel(build: StarterBuild): string {
  const fact = build.model.facts.find((entry) => entry.key === 'tech-level')
  return fact ? String(fact.value) : ''
}

type StarterCrewLedgerProps = {
  roster?: StarterRosterId
  /** Opens a copy's confirm: with it, signed in, each line ends in "Copy to…". */
  confirm?: Confirm
}

export function StarterCrewLedger({ roster = 'starter-set', confirm }: StarterCrewLedgerProps) {
  const rows = starterShelves(roster).flatMap((shelf) =>
    shelf.builds.map((build) => ({
      id: `${shelf.kind}-${build.id}`,
      name: build.name,
      entityRef: undefined,
      href: `/starter/${shelf.kind}/${build.id}`,
      cells: [build.model.kind.stamp, builtOn(build), techLevel(build)],
      ...(confirm
        ? {
            trailing: (
              <CopyStarterMenu
                kind={shelf.kind}
                templateId={build.id}
                name={build.name}
                confirm={confirm}
              />
            ),
          }
        : {}),
    }))
  )
  return (
    <Ledger
      label={buildStarterSetCopy('crewOf', { crew: starterRoster(roster).name })}
      nameLabel={buildStarterSetCopy('crew')}
      count={rows.length}
      columns={COLUMNS}
      rows={rows}
      foot={<CiteLine text={`${BOOK[roster]} // ${STARTER_SET_PUBLISHER}`} />}
    />
  )
}
