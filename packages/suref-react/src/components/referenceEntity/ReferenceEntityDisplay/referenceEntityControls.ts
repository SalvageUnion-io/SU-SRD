import { Circle, CircleCheck, Plus, Trash2 } from 'lucide-react'
import { DetailIcon } from './DetailIcon'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'

export function addControl(onClick: () => void): ReferenceEntityControl {
  return {
    key: 'add',
    icon: Plus,
    onClick,
    ariaLabel: 'Add',
    variant: 'primary',
  }
}

export function selectControl(onClick: () => void, selected?: boolean): ReferenceEntityControl {
  return {
    key: 'select',
    icon: selected ? CircleCheck : Circle,
    onClick,
    ariaLabel: selected ? 'Deselect' : 'Select',
    variant: 'ghost',
    className: selected ? 'opacity-100' : undefined,
  }
}

export function deleteControl(onClick: () => void): ReferenceEntityControl {
  return {
    key: 'delete',
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
    variant: 'ghost',
  }
}
