import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'

/**
 * Joins class names, dropping falsy entries (`cn('su-btn', active && 'is-on')`).
 * Every class it joins is a `.su-*` or app stylesheet class, so there is no
 * conflict to resolve: a later class never replaces an earlier one, the
 * stylesheet decides.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
