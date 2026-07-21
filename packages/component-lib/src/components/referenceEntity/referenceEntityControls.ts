import { DetailIcon } from './DetailIcon'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'

export function navigateControl(onClick: () => void): ReferenceEntityControl {
  return {
    key: 'navigate',
    icon: DetailIcon,
    onClick,
    ariaLabel: 'View details',
    hidden: true,
    cardClick: true,
  }
}
