import { Tooltip } from '@base-ui/react/tooltip'
import type { ReactNode } from 'react'
import { useContext } from 'react'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { isKeyword, SalvageUnionReference } from 'salvageunion-reference'
import { InsideTooltipContext } from '../ui/insideTooltipContext'
import { Tooltip as SimpleTooltip } from '../ui/tooltip'
import { ReferenceEntityCard } from './card/ReferenceEntityCard'

type EntityTooltipBase = {
  schemaName: SURefEnumSchemaName
  children: ReactNode
  /** Delay before showing tooltip in ms (default: 200) */
  openDelay?: number
  /** Whether the wrapper should take full width (default: false) */
  fullWidth?: boolean
}

/**
 * Address the entity by id, OR by name for the schemas the builders key by name
 * (chassis, systems, modules). Modelled as a union so passing both — two
 * disagreeing addresses for one entity — is a compile error rather than a
 * silent precedence rule.
 */
type EntityTooltipProps = EntityTooltipBase &
  ({ entityId: string; entityName?: never } | { entityName: string; entityId?: never })

/**
 * Resolve an entity id from a name, for schemas whose builders store names
 * rather than ids. Absorbed from the former `ContextualEntityDisplay`, which was
 * a thin wrapper whose only real content was this lookup plus a fallback
 * EntityTooltip already had.
 */
function resolveIdByName(schemaName: SURefEnumSchemaName, name: string): string | undefined {
  // Case-INSENSITIVE, like every other name→entity lookup in the library
  // (`parseTraitReferences`, `Stat`'s `entityTooltip`). Callers address entities
  // with the name as it reads on the surface — a capitalised trait type
  // ("Explosive") against a stored name that may be cased differently — and an
  // exact match silently dropped the hovercard on exactly those.
  const target = name.toLowerCase()
  const entity = SalvageUnionReference.findIn(
    schemaName,
    (e) => 'name' in e && String(e.name).toLowerCase() === target
  )
  return entity?.id
}

function getKeywordDescription(entity: unknown): string | null {
  if (
    typeof entity === 'object' &&
    entity !== null &&
    'content' in entity &&
    Array.isArray((entity as { content: unknown }).content)
  ) {
    const content = (entity as { content: { type: string; value: string }[] }).content
    const paragraphs = content.filter((block) => block.type === 'paragraph')
    return paragraphs.map((block) => block.value).join(' ') || null
  }
  return null
}

/**
 * EntityTooltip - Shows ReferenceEntityCard content in a hover card
 * Wraps children and displays entity details on hover
 * Keywords render as a simple text tooltip; other entities render as a full card.
 *
 * @example
 * // By id
 * <EntityTooltip schemaName="systems" entityId="laser-cannon-id">
 *   <Text>Hover me to see details</Text>
 * </EntityTooltip>
 *
 * @example
 * // By name — for schemas the builders key by name (chassis, systems, modules)
 * <EntityTooltip schemaName="chassis" entityName={chassisName}>
 *   <span>{chassisName}</span>
 * </EntityTooltip>
 */
export function EntityTooltip({
  schemaName,
  children,
  openDelay = 200,
  fullWidth = false,
  ...address
}: EntityTooltipProps) {
  const closeDelay = 100
  // Terminal law (ruleset §1): inside another tooltip's popup, render the
  // children bare — a hovercard never arms a nested hovercard (and never
  // wraps its trigger in a role="button" span there).
  const insideTooltip = useContext(InsideTooltipContext)
  const entityId =
    address.entityId ??
    (address.entityName ? resolveIdByName(schemaName, address.entityName) : undefined)
  // An unresolvable address renders the children bare — a missing entity must
  // never cost the caller its own content.
  const entity = entityId ? SalvageUnionReference.get(schemaName, entityId) : undefined

  if (!entity || insideTooltip) {
    return <>{children}</>
  }

  if (isKeyword(entity)) {
    const description = getKeywordDescription(entity)
    if (description) {
      return (
        <SimpleTooltip content={description} delayDuration={openDelay}>
          <span
            style={{
              margin: 0,
              lineHeight: 1,
              cursor: 'help',
              display: fullWidth ? 'block' : 'inline-flex',
              flexShrink: 0,
              flexGrow: 0,
              width: fullWidth ? '100%' : 'auto',
            }}
          >
            {children}
          </span>
        </SimpleTooltip>
      )
    }
  }

  return (
    <Tooltip.Provider delay={openDelay} closeDelay={closeDelay}>
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={openDelay}
          closeDelay={closeDelay}
          render={
            // biome-ignore lint/a11y/useSemanticElements: a native <button> cannot wrap the arbitrary block-level trigger content; span+role keeps the layout intact
            <span
              role="button"
              tabIndex={0}
              style={{
                margin: 0,
                lineHeight: 1,
                cursor: 'help',
                display: fullWidth ? 'block' : 'inline-flex',
                flexShrink: 0,
                flexGrow: 0,
                width: fullWidth ? '100%' : 'auto',
              }}
            />
          }
        >
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={5} align="start">
            <Tooltip.Popup className="z-50 max-h-[80vh] max-w-[500px] overflow-y-auto border-none bg-transparent p-0 shadow-2xl">
              {/* The DENSE, TERMINAL hovercard (ruleset §1 Tooltip context):
                  the catalog-extent card — seam, header, sub-header, artwork,
                  body prose — with every nested element (entity cards, action
                  grids, pattern lists, expandable choice listings) suppressed
                  by the extent, and the InsideTooltipContext making every
                  tooltip primitive in the subtree inert (no nested hovercards
                  from trait/keyword refs or Stat cells). */}
              <InsideTooltipContext.Provider value={true}>
                <ReferenceEntityCard data={entity} size="medium" extent="catalog" />
              </InsideTooltipContext.Provider>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
