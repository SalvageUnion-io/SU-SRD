import type { RefMetaEntity } from 'salvageunion-reference'
import { resolveTable } from 'salvageunion-reference'
import { tablePeekAddress } from '../../entity/peekContext'
import { CardRollTable } from './CardRollTable'

/**
 * An entity's own ROLL TABLE as its Token (EDL E14: Token, Table, Roll the
 * Die), for a host that draws the entity as a Token rather than a Card: a
 * crawler bay's Trading Bay Table, on the line under the bay's Token in its
 * `TokenGroup`, never inside the Token (E6). Its name Peeks the rows; its
 * roll is in its strip, off while the entity is down. Nothing when the
 * entity has no table.
 */
export function EntityRollToken({
  entity,
  disabled = false,
}: {
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
      nested
      peekAt={tablePeekAddress(entity)}
    />
  )
}
