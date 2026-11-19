import type { RefMetaEntity } from 'salvageunion-reference'
import { resolveTable } from 'salvageunion-reference'
import { tablePeekAddress } from '../../entity/peekContext'
import { CardRollTable } from './CardRollTable'

/**
 * An entity's own ROLL TABLE as its Mini (hard rule R8: nested in a card, a
 * Mini), for a host that draws the entity as a Mini rather than a Card: a
 * crawler bay's Trading Bay Table, on the line under the bay's Mini in its
 * `MiniGroup`, never inside the Mini (E6). Its name Peeks the rows; its
 * roll is in its strip, off while the entity is down. Nothing when the
 * entity has no table.
 */
export function EntityRollMini({
  entity,
  disabled = false,
  full = false,
}: {
  /** MOCK (best, revision 3): in an opened row the table prints whole, rows and all. */
  full?: boolean
  entity: RefMetaEntity
  /** The entity is down (a damaged bay): the roll is off. */
  disabled?: boolean
}) {
  const table = resolveTable(entity)
  if (!table) return null
  const name =
    'tableName' in entity && typeof entity.tableName === 'string' ? entity.tableName : entity.name
  return (
    <CardRollTable
      table={table}
      name={name}
      size="compact"
      disabled={disabled}
      nested={!full}
      {...(full ? {} : { peekAt: tablePeekAddress(entity) })}
    />
  )
}
