/**
 * The Pilot wizard's name gate (Workshop Manual p.19's Callsign step): the
 * name the owner's ruling makes required (`REQUIRED_PILOT_NAME`, r7 F7) must
 * be typed before Review; the other is optional.
 */

import { libRulesCopy } from '../../messages/lib-rules'
import type { PilotWizardFormState } from '../wizard/pilotFormState'
import { REQUIRED_PILOT_NAME } from '../wizard/pilotFormState'

export function callsignGate(form: PilotWizardFormState): { ok: boolean; reason?: string } {
  if (form[REQUIRED_PILOT_NAME].trim() !== '') return { ok: true }
  const callsign = REQUIRED_PILOT_NAME === 'callsign'
  return {
    ok: false,
    reason: libRulesCopy(callsign ? 'enterACallsignToContinue' : 'enterANameToContinue'),
  }
}
