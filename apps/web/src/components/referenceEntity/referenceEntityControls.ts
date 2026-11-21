import { referenceEntityCopy } from '../../messages/components-reference-entity'
import { DetailIcon } from './DetailIcon'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'

export function navigateControl(onClick: () => void): ReferenceEntityControl {
  return {
    key: 'navigate',
    icon: DetailIcon,
    onClick,
    ariaLabel: referenceEntityCopy('viewDetails'),
    hidden: true,
    cardClick: true,
  }
}
