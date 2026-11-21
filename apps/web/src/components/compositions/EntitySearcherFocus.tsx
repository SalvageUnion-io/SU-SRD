/**
 * `EntitySearcher`'s focus pane: the one entity being read, whole, as its
 * Page (EDL Form 5) — the band with the title notched in and its chips beside
 * it, the body, the foot — not a Card in a box: the pane IS the entity, as a
 * show page is, and scrolls as one sheet. An action bar under it adds it. On a
 * wide screen it is the middle column, there only once a Mini is opened; on a
 * narrow one it takes the picker over, with a back bar (the list's name) above it.
 * Removing is the sidebar's.
 */

import type { CSSProperties, ReactNode, Ref } from 'react'
import { borderWidth, color, fontSize, space } from '../../design/tokens'
import { compositionsCopy } from '../../messages/components-compositions'
import { BackLabel } from '../atoms/BackLabel'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { ChapterBandTrail } from '../atoms/ChapterBandTrail'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import type { ReferenceEntityCardHideConfig } from '../referenceEntity/card/referenceEntityCardTypes'
import { EntityDetailPage } from '../referenceEntity/EntityDetailDialog'
import type { PickCost, PoolEntity } from './entitySearcherTypes'

/**
 * The action bar reads the focused entity's state: a stamp saying how many
 * are chosen, then what can be done next. Toggle offers ADD until it is
 * chosen; count offers ADD ANOTHER; single offers CHOOSE until it is the one
 * chosen. ADD names the sheet it lands on (`railName`).
 */
export function FocusPane({
  entity,
  mode,
  count,
  chosenLabel,
  railName,
  listName,
  cost,
  hide,
  showChassisAbility,
  onAdd,
  extra,
  userMade,
  onBack,
  backRef,
}: {
  entity: PoolEntity
  mode: 'toggle' | 'count' | 'single'
  /** How many copies of `entity` are chosen. */
  count: number
  chosenLabel: string
  railName?: string
  /** The list the back bar returns to (the picker's title); "List" when it has none. */
  listName?: string
  /** What adding it costs, where the sheet can pay it as it adds. */
  cost?: PickCost
  hide: ReferenceEntityCardHideConfig
  showChassisAbility?: boolean
  onAdd: () => void
  /** A choice that goes with adding (which pattern), beside the button. */
  extra?: ReactNode
  /** The player's own entity: the Page credits no book. */
  userMade?: boolean
  /** Narrow only: back to the list. */
  onBack?: () => void
  backRef?: Ref<HTMLButtonElement>
}) {
  const chosen = count > 0
  const addLabel =
    mode === 'single'
      ? compositionsCopy('choose')
      : chosen
        ? compositionsCopy('addAnother')
        : railName
          ? compositionsCopy('addTo', { name: railName })
          : compositionsCopy('add')
  const canAdd = mode === 'count' || !chosen

  return (
    <div className="su-searcher__focus">
      {onBack && (
        <div style={BACK_BAR_STYLE}>
          <Button ref={backRef} size="compact" onClick={onBack}>
            <BackLabel to={listName || 'List'} />
          </Button>
        </div>
      )}
      <article aria-label={entity.name} className="su-searcher__scroll su-searcher__page">
        {/* No breadcrumb trail on the plate: the picker is not a page of the site. */}
        <ChapterBandTrail.Provider value={null}>
          {/* A column, not a page: the title at a phone page's size at every width. */}
          <EntityDetailPage
            entity={entity}
            title={entity.name}
            titleAs="h2"
            titleSize={fontSize.hero}
            // The player's own: credited to them, with no page to cite or link (MD2-09).
            credit={userMade ? compositionsCopy('yourDesign') : undefined}
          >
            <ReferenceEntityCard
              data={entity}
              presentation="page"
              // Its actions are what it is: a design has no Reference page to read them on.
              hide={userMade ? { ...hide, actions: false } : hide}
              userMade={userMade}
              showChassisAbility={showChassisAbility}
            />
          </EntityDetailPage>
        </ChapterBandTrail.Provider>
      </article>
      {/* biome-ignore lint/a11y/useSemanticElements: a toolbar of actions on the focused entity, not a form */}
      <div
        role="group"
        aria-label={`${entity.name} actions`}
        className="su-searcher__actions"
        style={ACTION_BAR_STYLE}
      >
        {chosen && (
          <Badge shape="stamp">{mode === 'count' ? `${count} ${chosenLabel}` : chosenLabel}</Badge>
        )}
        {canAdd && cost && <Badge shape="stamp">{cost.label}</Badge>}
        <span style={GROW_STYLE} />
        {extra}
        {canAdd && (
          <Button variant={cost?.canPay ? undefined : 'primary'} size="compact" onClick={onAdd}>
            {addLabel}
          </Button>
        )}
        {canAdd && cost && (
          <Button variant="primary" size="compact" disabled={!cost.canPay} onClick={cost.onPay}>
            {cost.payLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

const BACK_BAR_STYLE = {
  display: 'flex',
  padding: `${space[12]} ${space[16]}`,
  borderBottom: `${borderWidth.hairline} solid ${color.ink20}`,
  backgroundColor: color.paper,
} satisfies CSSProperties

const ACTION_BAR_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[8],
  padding: `${space[12]} ${space[16]}`,
  borderTop: `${borderWidth.chrome} solid ${color.ink}`,
  backgroundColor: color.paper,
} satisfies CSSProperties

const GROW_STYLE = { flex: '1 1 auto' } satisfies CSSProperties
