import { describe, expect, test } from 'bun:test'
import { cloudDeploymentRefusal } from '../assert-local-convex'

describe('cloudDeploymentRefusal', () => {
  test('allows an unset deployment, so `convex dev` can ask on first run', () => {
    expect(cloudDeploymentRefusal(undefined)).toBeNull()
    expect(cloudDeploymentRefusal('')).toBeNull()
  })

  test('allows local and anonymous deployments', () => {
    expect(cloudDeploymentRefusal('local:local-alex_jarvis-suref_itun')).toBeNull()
    expect(cloudDeploymentRefusal('anonymous:anonymous-itun')).toBeNull()
  })

  test('refuses a cloud dev deployment, ignoring the trailing comment', () => {
    const refusal = cloudDeploymentRefusal(
      'dev:perfect-donkey-72 # team: alex-jarvis, project: suref-itun'
    )
    expect(refusal).toContain('CONVEX_DEPLOYMENT=dev:perfect-donkey-72 is not a local deployment.')
    expect(refusal).toContain('--dev-deployment local')
  })

  test('refuses prod, preview and an unprefixed name', () => {
    for (const value of ['prod:exuberant-porpoise-183', 'preview:pr-12', 'perfect-donkey-72']) {
      expect(cloudDeploymentRefusal(value)).not.toBeNull()
    }
  })
})
