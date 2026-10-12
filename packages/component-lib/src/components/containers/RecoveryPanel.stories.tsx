import { borderWidth, color, fontSize, radius, space } from '../../design/tokens'
import { PRODUCT } from '../../product'
import type { Story } from '../../stories/_harness'
import { RecoveryPanel } from './RecoveryPanel'

export default {
  title: 'Containers/Recovery Panel',
}

// RecoveryPanel is content-agnostic chrome — no SRD entity flows through it.
// The stories use the REAL production copy the two apps ship: srd's island
// error boundary, itun's generic root error, and itun's blocked-upgrade case.
const noop = () => {}

export const Default: Story = () => (
  <RecoveryPanel
    title="Something went wrong"
    message="The app hit an unexpected error. Your saved data is stored locally and is not affected."
    action={{ label: 'Reload app', onClick: noop }}
  />
)

export const BlockedUpgrade: Story = () => (
  <RecoveryPanel
    title="Close the other tab"
    message={`${PRODUCT.name} is open in another browser tab running an older version, which is blocking this one from loading. Close every other ${PRODUCT.name} tab, then reload. Your saved data is safe.`}
    action={{ label: 'Reload', onClick: noop }}
  />
)

export const WithDevDump: Story = () => (
  <RecoveryPanel
    title="Something went wrong"
    message="The app hit an unexpected error. Your saved data is stored locally and is not affected."
    action={{ label: 'Reload app', onClick: noop }}
  >
    <pre
      style={{
        maxWidth: '100%',
        overflow: 'auto',
        borderRadius: radius.card,
        borderStyle: 'solid',
        borderWidth: borderWidth.chrome,
        borderColor: color.ink20,
        backgroundColor: color.wkBg,
        padding: space[12],
        textAlign: 'left',
        fontSize: fontSize.xs,
        lineHeight: '16px',
        color: color.ink,
      }}
    >
      Cannot read properties of undefined (reading 'chassis')
    </pre>
  </RecoveryPanel>
)
