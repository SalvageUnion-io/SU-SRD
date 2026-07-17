/**
 * Re-exported from component-lib so both cn() implementations share ONE
 * tailwind-merge config — the extended one that knows about the custom
 * text/tracking/border-width utilities (see component-lib/src/utils/cn.ts).
 * A second, default-config twMerge here would silently strip classes like
 * `border-entity` or `text-badge` whenever a color class shares the list.
 */
export { cn } from 'component-lib'
