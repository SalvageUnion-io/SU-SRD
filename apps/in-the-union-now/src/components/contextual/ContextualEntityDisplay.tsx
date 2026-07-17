/**
 * ContextualEntityDisplay — shows full entity data inline in builder flows.
 *
 * Wraps children in a EntityTooltip from component-lib.
 * Supports two resolution strategies:
 *   - byId: pass entityId directly (classes, abilities)
 *   - byName: resolve id from a name lookup (chassis, systems, modules — which
 *     the builders store by name, not id)
 *
 * When entityId cannot be resolved the children render unwrapped (no tooltip).
 */
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { EntityTooltip } from 'component-lib'

type ById = {
  schemaName: SURefEnumSchemaName
  entityId: string
  entityName?: never
}

type ByName = {
  schemaName: SURefEnumSchemaName
  entityName: string
  entityId?: never
}

type ContextualEntityDisplayProps = (ById | ByName) & {
  children: ReactNode
  /** Whether the wrapper should take full width (default: false) */
  fullWidth?: boolean
}

/**
 * Resolve an entity id from a name for schemas where builders key by name.
 * Returns undefined if not found.
 */
function resolveIdByName(schemaName: SURefEnumSchemaName, name: string): string | undefined {
  const entity = SalvageUnionReference.findIn(
    schemaName,
    (e): e is typeof e => 'name' in e && (e as { name: unknown }).name === name
  )
  return entity?.id
}

/**
 * ContextualEntityDisplay — inline hover card showing full entity data.
 *
 * @example
 * // By id (classes, abilities)
 * <ContextualEntityDisplay schemaName="classes" entityId={cls.id}>
 *   <button>{cls.name}</button>
 * </ContextualEntityDisplay>
 *
 * @example
 * // By name (chassis, systems, modules)
 * <ContextualEntityDisplay schemaName="chassis" entityName={chassisName}>
 *   <span>{chassisName}</span>
 * </ContextualEntityDisplay>
 */
export function ContextualEntityDisplay({
  schemaName,
  children,
  fullWidth = false,
  ...rest
}: ContextualEntityDisplayProps) {
  const entityId =
    'entityId' in rest && rest.entityId != null
      ? rest.entityId
      : 'entityName' in rest && rest.entityName != null
        ? resolveIdByName(schemaName, rest.entityName)
        : undefined

  if (!entityId) {
    return <>{children}</>
  }

  return (
    <EntityTooltip schemaName={schemaName} entityId={entityId} fullWidth={fullWidth}>
      {children}
    </EntityTooltip>
  )
}
