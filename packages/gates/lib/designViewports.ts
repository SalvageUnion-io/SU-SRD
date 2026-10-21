/**
 * The two widths every layout gate holds a page at (hard rule R0), shared by
 * the gates (`apps/web/e2e/_designTable.ts`) and `bun run shot`'s `phone` and
 * `page`, so a screenshot shows what the gate measured. `page` is a desktop
 * window, and for Play its canvas at the design size (`_play.ts`'s `CANVAS`,
 * 1280 × 800), where a measured px is a drawn px. `phone` is a phone, and for
 * Play its phone form, every tab of it.
 */

export type DesignWidth = 'phone' | 'page'

export const DESIGN_VIEWPORTS: Record<DesignWidth, { width: number; height: number }> = {
  page: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
}
