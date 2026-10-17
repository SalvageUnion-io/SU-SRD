/**
 * `EntitySearcher`'s focus pane: the one entity being read, whole, as its
 * medium Card, over an action bar that adds or removes it. On a wide screen it
 * is the middle column, always showing something; on a narrow one it takes
 * the picker over when a Token is opened, with a Back to list bar above it.
 */

import { ArrowLeft } from 'lucide-react'
import type { CSSProperties, Ref } from 'react'
import { borderWidth, color, space } from '../../design/tokens'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import type { ReferenceEntityCardHideConfig } from '../referenceEntity/card/referenceEntityCardTypes'
import type { PoolEntity } from './entitySearcherTypes'

/**
 * The action bar reads the focused entity's state: a stamp saying how many
 * are chosen, then what can be done next. Toggle offers ADD or REMOVE; count
 * offers ADD ANOTHER and REMOVE (the last copy); single offers CHOOSE until it
 * is the one chosen. ADD names the sheet it lands on (`railName`).
 */
export function FocusPane({
  entity,
  mode,
  count,
  chosenLabel,
  railName,
  hide,
  showChassisAbility,
  onAdd,
  onRemove,
  onBack,
  backRef,
}: {
  entity: PoolEntity
  mode: 'toggle' | 'count' | 'single'
  /** How many copies of `entity` are chosen. */
  count: number
  chosenLabel: string
  railName?: string
  hide: ReferenceEntityCardHideConfig
  showChassisAbility?: boolean
  onAdd: () => void
  /** Absent when the caller cannot remove (no `onRemove` in count mode). */
  onRemove?: () => void
  /** Narrow only: back to the list. */
  onBack?: () => void
  backRef?: Ref<HTMLButtonElement>
}) {
  const chosen = count > 0
  const addLabel =
    mode === 'single' ? 'Choose' : chosen ? 'Add another' : railName ? `Add to ${railName}` : 'Add'
  const canAdd = mode === 'count' || !chosen
  const canRemove = chosen && mode !== 'single' && onRemove !== undefined

  return (
    <div className="su-searcher__focus">
      {onBack && (
        <div style={BACK_BAR_STYLE}>
          <Button ref={backRef} size="compact" onClick={onBack}>
            <ArrowLeft aria-hidden="true" size={14} /> Back to list
          </Button>
        </div>
      )}
      <div className="su-searcher__scroll" style={CARD_SCROLL_STYLE}>
        <ReferenceEntityCard
          data={entity}
          size="medium"
          hide={hide}
          showChassisAbility={showChassisAbility}
        />
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: a toolbar of actions on the focused entity, not a form */}
      <div role="group" aria-label={`${entity.name} actions`} style={ACTION_BAR_STYLE}>
        {chosen && (
          <Badge shape="stamp">{mode === 'count' ? `${count} ${chosenLabel}` : chosenLabel}</Badge>
        )}
        <span style={GROW_STYLE} />
        {canRemove && (
          <Button size="compact" onClick={onRemove} aria-label={`Remove ${entity.name}`}>
            Remove
          </Button>
        )}
        {canAdd && (
          <Button variant="primary" size="compact" onClick={onAdd}>
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

const BACK_BAR_STYLE = {
  display: 'flex',
  padding: `${space[10]} ${space[16]}`,
  borderBottom: `${borderWidth.hairline} solid ${color.ink20}`,
  backgroundColor: color.paper,
} satisfies CSSProperties

const CARD_SCROLL_STYLE = { padding: space[16] } satisfies CSSProperties

const ACTION_BAR_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[8],
  padding: `${space[10]} ${space[16]}`,
  borderTop: `${borderWidth.chrome} solid ${color.ink}`,
  backgroundColor: color.paper,
} satisfies CSSProperties

const GROW_STYLE = { flex: '1 1 auto' } satisfies CSSProperties
