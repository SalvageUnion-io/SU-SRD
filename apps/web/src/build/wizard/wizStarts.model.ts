/**
 * What `NewEntityScreen` hands a unit's wizard for the lines under its first
 * step's title (`WizStarts.tsx`, r6 F2): the other ways to start, and a kept
 * draft's Continue · Discard. None, the wizard shows neither.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { createContext } from 'react'
import type { CreateMode } from '../../lib/wizard/createMode'
import { buildWizardCopy } from '../../messages/build-wizard'

export type WizStarts = {
  kind: SheetKind
  /** Go to another way to start (`?mode=blank`, `?mode=pattern`). */
  onStart: (mode: CreateMode) => void
  /** Who the build is for ("For Nia Vale: the Mech is assigned to them…"), as the chooser said it. */
  forLine: string | undefined
  /** Discard the kept draft: the wizard starts again, empty. */
  onDiscard: () => void
}

export const WizStartsContext = createContext<WizStarts | null>(null)

/** Who a build is for, in the chooser's words: a pilot's mech, a mech's pilot, a crawler's crew. */
export function forLine({
  forPilot,
  forMech,
  forCrew,
}: {
  forPilot?: string | undefined
  forMech?: string | undefined
  forCrew?: string | undefined
}): string | undefined {
  if (forPilot !== undefined) return buildWizardCopy('forPilot', { name: forPilot })
  if (forMech !== undefined) return buildWizardCopy('forMech', { name: forMech })
  return forCrew
}
