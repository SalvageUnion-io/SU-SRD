/**
 * Whether the wizard has taught its rules yet (r7 F10): once the player has a
 * finished build of their own, a step's long rule box shows as one "Rules for
 * this step" line that opens in place (`RuleBrief`), since by the tenth build
 * it is only scrolling. A newcomer, signed out or with nothing built, reads
 * every rule. `WizShell` answers it for the steps it draws; anywhere else
 * (Play's blocked action) it is false.
 */

import { createContext } from 'react'
import { useOwnUnits } from '../../lib/entities/entities'

export const WizTaughtContext = createContext(false)

/** True once the player owns a finished Pilot, Mech or Union Crawler. */
export function useWizTaught(): boolean {
  const pilots = useOwnUnits('pilot').length
  const mechs = useOwnUnits('mech').length
  const crawlers = useOwnUnits('crawler').length
  return pilots + mechs + crawlers > 0
}
