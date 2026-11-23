import { Field, Input } from '../../components/index'
import { REQUIRED_PILOT_NAME } from '../../lib/wizard/pilotFormState'
import { buildWizardCopy } from '../../messages/build-wizard'
import { RollTableButton } from './RollTableButton'
import type { RollTableDeps } from './rollTableHelpers.model'
import { PILOT_IDENTITY_ROLLS } from './rollTableHelpers.model'
import { fieldRowStyle, stepColumnStyle } from './wizardStyles.model'

type CallsignStepProps = {
  name: string
  callsign: string
  onChange: (field: 'name' | 'callsign', value: string) => void
  /** Injectable deps for testing. */
  _rollDeps?: RollTableDeps
}

/**
 * Step 4 · Choose your Callsign (Pilot Bay p.19), with the Name beside it.
 * Which of the two is required is the owner's ruling (`REQUIRED_PILOT_NAME`,
 * r7 F7): the Callsign, the name the game uses; the Name is optional and,
 * left blank, is stored as the Callsign, which its placeholder shows. Each has
 * a Roll on the p.88 Callsign Table (an assist: the result stays editable).
 */
export function CallsignStep({ name, callsign, onChange, _rollDeps }: CallsignStepProps) {
  const callsignRequired = REQUIRED_PILOT_NAME === 'callsign'
  const callsignField = (
    <Field
      key="callsign"
      label={buildWizardCopy('callsign')}
      required={callsignRequired}
      htmlFor="pilot-callsign"
    >
      <div style={fieldRowStyle}>
        <Input
          id="pilot-callsign"
          type="text"
          value={callsign}
          onChange={(e) => onChange('callsign', e.target.value)}
          placeholder={
            (callsignRequired ? '' : name.trim()) || buildWizardCopy('yourPilotCallsign')
          }
          required={callsignRequired}
        />
        <RollTableButton
          field={PILOT_IDENTITY_ROLLS.callsign}
          onRoll={(value) => onChange('callsign', value)}
          ariaLabel={buildWizardCopy('roll', { lowerCase: 'callsign' })}
          _deps={_rollDeps}
        />
      </div>
    </Field>
  )
  const nameField = (
    <Field
      key="name"
      label={buildWizardCopy(callsignRequired ? 'nameOptional' : 'name')}
      required={!callsignRequired}
      htmlFor="pilot-name"
    >
      <div style={fieldRowStyle}>
        <Input
          id="pilot-name"
          type="text"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          // Left blank, it is the Callsign: the placeholder shows it.
          placeholder={
            (callsignRequired ? callsign.trim() : '') || buildWizardCopy('yourPilotsRealName')
          }
          required={!callsignRequired}
        />
        <RollTableButton
          field={PILOT_IDENTITY_ROLLS.name}
          onRoll={(value) => onChange('name', value)}
          ariaLabel={buildWizardCopy('roll', { lowerCase: 'name' })}
          _deps={_rollDeps}
        />
      </div>
    </Field>
  )
  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={stepColumnStyle}>
      {callsignRequired ? [callsignField, nameField] : [nameField, callsignField]}
    </div>
  )
}
