/**
 * NpcPickRows — the NPC designer's Actions & traits step, one line a pick
 * (D6): the action's or trait's header-only Row, opening its full rules, with
 * its Carry toggle the Row's last chip (C8, hard rule R6).
 */

import { Check } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { RefEntity } from 'salvageunion-reference'
import { displayTitle, SalvageUnionReference } from 'salvageunion-reference'
import { Entity, Toggle, tokens, useDetailModal } from '../../components/index'
import { npcActionName, resolveNpcAction } from '../../lib/npcs/npcModel'
import { readReference } from '../../lib/readReference'
import { HINT } from './npcStyles.model'

const PICK_ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
} satisfies CSSProperties

const GROW = { flex: 1, minWidth: 0 } satisfies CSSProperties

/**
 * One header-only card that opens the full rules (D6), its Carry toggle the
 * Row's last chip (C8, hard rule R6); a name the reference lacks has its
 * toggle beside it.
 */
function PickRow({
  label,
  carried,
  onToggle,
  children,
}: {
  label: string
  carried: boolean
  onToggle: (carried: boolean) => void
  /** The Row, handed its Carry toggle for its controls. */
  children: (carry: ReactNode) => ReactNode
}) {
  const carry = (
    <Toggle size="mini" pressed={carried} aria-label={label} onClick={() => onToggle(!carried)}>
      {carried && <Check size={tokens.iconSize.mini} aria-hidden="true" />}
      Carry
    </Toggle>
  )
  return (
    <li className="su-npc-pick" style={PICK_ROW}>
      {children(carry)}
    </li>
  )
}

export function ActionPick({
  slug,
  carried,
  onToggle,
}: {
  slug: string
  carried: boolean
  onToggle: (carried: boolean) => void
}) {
  const action = resolveNpcAction(slug)
  // An action is a meta entity, which the detail modal's card renders as it
  // renders any other; the hook is typed to the plain union only.
  const detail = useDetailModal((action ?? undefined) as RefEntity | undefined)
  const name = action?.name ?? npcActionName(slug)
  return (
    <PickRow label={`Carry ${name}`} carried={carried} onToggle={onToggle}>
      {(carry) => (
        <>
          {action ? (
            <div style={GROW}>
              <Entity
                form="row"
                entity={action}
                mode={{
                  kind: 'link',
                  onOpen: () => detail.control.onClick?.(),
                  attrs: { 'aria-label': `Open ${name}` },
                }}
                controls={carry}
              />
            </div>
          ) : (
            <>
              <span style={{ ...HINT, ...GROW }}>{name}</span>
              {carry}
            </>
          )}
          {detail.modal}
        </>
      )}
    </PickRow>
  )
}

export function TraitPick({
  type,
  amount,
  carried,
  onToggle,
}: {
  type: string
  amount: number | string | undefined
  carried: boolean
  onToggle: (carried: boolean) => void
}) {
  const trait = readReference(
    'AnyNpcDesigner.trait',
    () => SalvageUnionReference.Traits.getByName(type) ?? null,
    null
  )
  const detail = useDetailModal(trait ?? undefined)
  const name = displayTitle(type)
  const label = amount === undefined ? name : `${name} (${amount})`
  return (
    <PickRow label={`Carry ${label}`} carried={carried} onToggle={onToggle}>
      {(carry) => (
        <>
          {trait ? (
            <div style={GROW}>
              <Entity
                form="row"
                entity={trait}
                instance={{ title: label }}
                mode={{
                  kind: 'link',
                  onOpen: () => detail.control.onClick?.(),
                  attrs: { 'aria-label': `Open ${label}` },
                }}
                controls={carry}
              />
            </div>
          ) : (
            <>
              <span style={{ ...HINT, ...GROW }}>{label}</span>
              {carry}
            </>
          )}
          {detail.modal}
        </>
      )}
    </PickRow>
  )
}
