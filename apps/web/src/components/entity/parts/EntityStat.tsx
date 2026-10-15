import type { EntityRef } from 'salvageunion-reference'
import type { SizeRung } from '../../../styles/sizing'
import { Stat } from '../../atoms/Stat'
import { LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { useInsidePeek, usePeekAttrs } from '../peekContext'

/**
 * A FACT WHOSE VALUE IS AN ENTITY — what a unit is built as (`CLASS |
 * Engineer`, `CHASSIS | Mazona`, `TYPE | Exploratory`), what a pattern is a
 * pattern of: the label-first horizontal `Stat` chip every fact is (EDL E9,
 * ruleset §3.7), and, like a Tag, a way to the entity it names. It opens that
 * entity — `href` where the caller has the route, else the surface's (the
 * SRD's page, the Cantina's detail dialog) — and Peeks it on hover, focus or a long
 * press. Inside a Peek it only reads (E16).
 *
 * The chip wraps rather than cutting the name (E18).
 */
export function EntityStat({
  label,
  entityRef,
  href,
  rung = 'full',
}: {
  /** What the entity is to its holder: 'Class', 'Chassis', 'Type', 'Pattern of'. */
  label: string
  /** The entity named: its name is the chip's value. */
  entityRef: EntityRef
  /** The entity's route, when the caller has one the surface does not know. */
  href?: string
  rung?: SizeRung
}) {
  const insidePeek = useInsidePeek()
  const target = useLinkTarget(
    insidePeek ? { kind: 'read' } : { kind: 'link', ...(href ? { href } : {}) },
    entityRef
  )
  const peek = usePeekAttrs(entityRef)
  return (
    <LinkSurface
      target={target}
      label={`${label}: ${entityRef.name}`}
      peek={peek}
      className="su-chip-link su-chip-link--entity"
    >
      <Stat orientation="horizontal" label={label} value={entityRef.name} size={rung} wrap />
    </LinkSurface>
  )
}
