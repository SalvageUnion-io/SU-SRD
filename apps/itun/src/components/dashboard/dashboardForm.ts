/**
 * dashboardForm — which form of the Dashboard is rendering (ADR-044): the
 * fixed `canvas`, or the `phone` form's one scrolling column.
 *
 * A form is a renderer, never a second home for play state. The same Majors
 * (`PilotMajor`, `MechMajor`, `CrawlerMajor`) build the same `MajorModel` with
 * the same handlers in both; `MajorFrame` reads this to choose how to draw
 * it, and a Major reads it only to order its bays and spell its buttons out
 * where the phone has the room ("Heat Check" for the canvas's "Heat Chk").
 *
 * No provider means the canvas, so every existing caller and story keeps the
 * canvas without saying so. The phone form wraps each unit tab in
 * `<DashboardFormContext value={{ form: 'phone', between }}>`.
 */

import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'
import type { SlotKind } from './slotLayout'
import { slotsFor } from './slotLayout'
import type { MountState } from './useSeat'

/** The canvas's design size, in CSS px (ADR-038 §9). */
export const CANVAS_W = 1280
export const CANVAS_H = 800

/**
 * The canvas's legibility floor: below this scale its 9px labels and 44px
 * targets shrink past reading and touching (ADR-044 §1).
 */
const MIN_SCALE = 0.62

/**
 * Whether a host of `width` × `height` CSS px gets the phone form: it would
 * draw the canvas below `MIN_SCALE` on EITHER axis. Both axes, because the
 * issue's complaint (44px targets drawn at about 27px) is just as true of a
 * landscape phone, which the old width-only guard let through at about 0.49.
 */
export function isPhoneForm(width: number, height: number): boolean {
  return Math.min(width / CANVAS_W, height / CANVAS_H) < MIN_SCALE
}

/**
 * The phone's open unit tab (ADR-044 D4). It opens on the Major and follows
 * the Major whenever the mount changes: Board selects Mech, Dismount and
 * Eject select Pilot, Downtime starting selects Crawler and ending selects
 * the seat's Major again. Nothing else moves it; the player does. It is
 * device state (ADR-038 §2), reset with the page.
 */
export function useUnitTab(mount: MountState): [SlotKind, (tab: SlotKind) => void] {
  const major = slotsFor(mount).major
  const [tab, setTab] = useState<SlotKind>(major)
  const [seen, setSeen] = useState<MountState>(mount)
  // Adjusted while rendering, not in an effect, so the new Major's tab is
  // the one drawn in the same pass the mount changes in.
  if (seen !== mount) {
    setSeen(mount)
    setTab(major)
  }
  return [tab, setTab]
}

export type DashboardForm =
  | { form: 'canvas' }
  | {
      form: 'phone'
      /**
       * What the phone draws between a Major's main bays and its side bays:
       * the deck on the Major's own tab (D6), Downtime's guide on the
       * Crawler's (D11), nothing on the others. The side bays (Effects,
       * Egress, Upkeep…) are the rarely used column, so they come last.
       */
      between: ReactNode
    }

const CANVAS: DashboardForm = { form: 'canvas' }

export const DashboardFormContext = createContext<DashboardForm>(CANVAS)

export function useDashboardForm(): DashboardForm {
  return useContext(DashboardFormContext)
}

/** Whether the Dashboard is drawing its phone form. */
export function usePhoneForm(): boolean {
  return useDashboardForm().form === 'phone'
}
