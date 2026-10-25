/**
 * The two widths every layout gate holds a page at (hard rule R0), shared by
 * the gates (`apps/web/e2e/_designTable.ts`) and `bun run shot`'s `phone` and
 * `page`, so a screenshot shows what the gate measured. `page` is a desktop
 * window, and for Play its three columns (`_play.ts`'s `WIDE`). `phone` is a
 * phone, and for Play its tabs, every one of them.
 */

export type DesignWidth = 'phone' | 'page'

export const DESIGN_VIEWPORTS: Record<DesignWidth, { width: number; height: number }> = {
  page: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
}
