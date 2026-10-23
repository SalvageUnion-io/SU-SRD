/** The words of apps/web/src/components/atoms: the message catalogue (ADR-054). */

import { messages } from './define'

export const atomsCopy = messages({
  backTo: 'Back to',
  breadcrumb: 'Breadcrumb',
  removeCondition: 'Remove condition {label}',
  add: '+ Add',
  addCondition: 'Add condition',
  copied: 'Copied',
  change: 'Change {lowerCase}',
  edit: 'Edit {lowerCase}',
  next: 'Next:',
  skipToContent: 'Skip to content',
  decrease: 'Decrease {stepName}',
  increase: 'Increase {stepName}',
  howThisIsDerived: '{statLabel}: how this is derived',
  showing: 'Showing',
  activateToMark: '{current}. Activate to mark {value}',
  decrease2: 'Decrease {label}',
  increase2: 'Increase {label}',
  setMax: 'Set {label} max',
  overrideMaxCurrently: 'Override {label} max (currently {max})',
  max: 'Max {label}',
  overriddenFrom: 'Overridden from {overriddenFrom}',
  revertMaxToDerived: 'Revert {label} max to derived {overriddenFrom}',
  revertToDerived: 'Revert to derived ({overriddenFrom})',
  overriddenFrom2: 'overridden from {overriddenFrom}',
})
