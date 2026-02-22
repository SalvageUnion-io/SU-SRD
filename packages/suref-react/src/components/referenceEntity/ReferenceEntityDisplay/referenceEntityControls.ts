import { Plus, Trash2 } from 'lucide-react'
import { DetailIcon } from './DetailIcon'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'

export function addControl(onClick: () => void): ReferenceEntityControl {
  return {
    key: 'add',
    icon: Plus,
    onClick,
    ariaLabel: 'Add',
    variant: 'primary',
    hidden: true,
    cardClick: true,
  }
}

export function selectControl(onClick: () => void, selected?: boolean): ReferenceEntityControl {
  return {
    key: 'select',
    label: selected ? 'Selected' : 'Select',
    onClick,
    ariaLabel: selected ? 'Deselect' : 'Select',
    variant: 'primary',
  }
}

export function deleteControl(onClick: () => void): ReferenceEntityControl {
  return {
    key: 'delete',
    label: 'Delete',
    icon: Trash2,
    onClick,
    ariaLabel: 'Delete',
    variant: 'danger',
  }
}

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
