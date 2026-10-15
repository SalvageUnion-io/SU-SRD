/**
 * UnitRow — a player unit (pilot, mech, crawler, NPC) in a list: the library
 * Row (`<Entity form="row">`) over `unitRowModel`, with the host's controls in
 * its head's trailing slot (EDL E7). The name sits on the Row's paper
 * cut-out, the readings are label-first chips (`SP | 9/9`), the note and any
 * host labels (an owner seal, ★ Primary, User-made) sit right of the title
 * (ruleset §3.9, §7.2), and View / Unassign are the last controls.
 *
 * View is a control rather than the Row's own link because the Row carries
 * other controls (Assign, Make a copy): a host that wants the whole Row to
 * open passes a `mode` instead.
 */

import type { EntityMode } from 'component-lib'
import { Button, buttonVariants, Entity } from 'component-lib'
import { space } from 'component-lib/design/tokens'
import { Unlink } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { UnitKind, UnitReading } from '../../lib/units/unitModel'
import { unitRowModel } from '../../lib/units/unitModel'
import { AppLink } from './AppLink'

const VIEW_LINK = { textDecorationLine: 'none' } satisfies CSSProperties

const UNASSIGN_GLYPH = { height: space[14], width: space[14] } satisfies CSSProperties

type UnitRowProps = {
  kind: UnitKind
  name: string
  /** A stamp right of the name that says more than the kind ("Home Crawler"). */
  note?: string | undefined
  readings?: readonly UnitReading[] | undefined
  /** A player-made unit (an NPC): dashed, its name quoted, User-made (§3.9). */
  userMade?: boolean
  /** Labels after the note (an owner seal, ★ Primary). */
  labels?: ReactNode
  /** The host's last chip, on the name's line: the unit's "⋯" menu. */
  trailing?: ReactNode
  /** The unit's sheet: a View control. Omit when there is nothing to open. */
  href?: string | undefined
  /** Ends the assignment (never deletes the unit). Omit to hide it. */
  onUnassign?: (() => void) | undefined
  /** Controls before View and Unassign (Assign, Make a copy). */
  controls?: ReactNode
  /** Default `read`: the controls are the Row's doors. */
  mode?: EntityMode
}

export function UnitRow({
  kind,
  name,
  note,
  readings,
  userMade = false,
  labels,
  trailing,
  href,
  onUnassign,
  controls,
  mode,
}: UnitRowProps) {
  const all =
    controls || href !== undefined || onUnassign ? (
      <>
        {controls}
        {href !== undefined && (
          <AppLink
            href={href}
            // The visible label is "View" on every row; the name says which
            // unit it opens (WCAG 2.4.4).
            aria-label={`View ${name}`}
            className={buttonVariants({ variant: 'default', size: 'mini' })}
            style={VIEW_LINK}
          >
            View
          </AppLink>
        )}
        {onUnassign && (
          <Button
            variant="ghost"
            size="mini"
            aria-label={`Unassign ${name}`}
            onClick={onUnassign}
            glyph={<Unlink style={UNASSIGN_GLYPH} />}
          >
            Unassign
          </Button>
        )}
      </>
    ) : undefined
  return (
    <Entity
      form="row"
      model={unitRowModel({ kind, name, note, userMade, readings: readings ?? [] })}
      mode={mode}
      labels={labels}
      trailing={trailing}
      controls={all}
    />
  )
}
