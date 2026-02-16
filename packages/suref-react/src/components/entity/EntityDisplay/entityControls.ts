import { Circle, CircleCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { DetailIcon } from './DetailIcon'
import type { EntityControl } from './entityControlTypes'

export function addControl(onClick: () => void): EntityControl {
  return {
    key: 'add',
    icon: Plus,
    onClick,
    ariaLabel: 'Add',
    variant: 'primary',
  }
}

export function selectControl(onClick: () => void, selected?: boolean): EntityControl {
  return {
    key: 'select',
    icon: selected ? CircleCheck : Circle,
    onClick,
    ariaLabel: selected ? 'Deselect' : 'Select',
    variant: 'ghost',
    className: selected ? 'opacity-100' : undefined,
  }
}

export function deleteControl(onClick: () => void): EntityControl {
  return {
    key: 'delete',
    icon: Trash2,
    onClick,
    ariaLabel: 'Delete',
    variant: 'danger',
  }
}

export function editControl(onClick: () => void): EntityControl {
  return {
    key: 'edit',
    icon: Pencil,
    onClick,
    ariaLabel: 'Edit',
    variant: 'ghost',
  }
}

export function navigateControl(onClick: () => void): EntityControl {
  return {
    key: 'navigate',
    icon: DetailIcon,
    onClick,
    ariaLabel: 'View details',
    variant: 'ghost',
  }
}
