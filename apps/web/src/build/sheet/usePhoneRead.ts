import { widthAtLeast } from '../../design/tokens'
import { useMediaQuery } from '../../lib/useMediaQuery'

/** Whether this render is the phone's Read sheet (`PhoneSheet`). */
export function usePhoneRead(readOnly: boolean): boolean {
  const phone = !useMediaQuery(widthAtLeast('sm'), true)
  return phone && readOnly
}
