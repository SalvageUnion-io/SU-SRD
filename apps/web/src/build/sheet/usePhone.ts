import { widthAtLeast } from '../../design/tokens'
import { useMediaQuery } from '../../lib/useMediaQuery'

/** Whether this render is at a phone's width, where the dashboard stacks. */
export function usePhone(): boolean {
  return !useMediaQuery(widthAtLeast('sm'), true)
}
