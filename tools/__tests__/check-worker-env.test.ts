import { describe, expect, test } from 'bun:test'
import { bindingNames, declaredEnvKeys, discoverWorkers } from '../check-worker-env'

describe('bindingNames', () => {
  test('reads the base interface wrangler types emits', () => {
    const generated = `/* eslint-disable */
interface __BaseEnv_Env {
\tSNAPSHOTS: R2Bucket;
\tRATE_LIMITER: RateLimit;
\tDISCORD_APPLICATION_ID: "1442878052823470172";
}
declare namespace Cloudflare { interface Env extends __BaseEnv_Env {} }
interface Env extends __BaseEnv_Env {}`
    expect(bindingNames(generated)).toEqual(['SNAPSHOTS', 'RATE_LIMITER', 'DISCORD_APPLICATION_ID'])
  })

  test('throws, rather than passing vacuously, when the format changes', () => {
    expect(() => bindingNames('interface Env { A: string }')).toThrow(/format changed/)
  })
})

describe('declaredEnvKeys', () => {
  test('collects top-level keys, including one whose type opens a nested literal', () => {
    const source = `
export type Env = ObservabilityEnv & {
  /** Static assets. { not a brace that counts } */
  ASSETS: { fetch(request: Request): Promise<Response> }
  SNAPSHOTS: R2BucketLike
  // RATE_LIMITER: commented out does not count
  OG_METRICS?: AnalyticsEngineDataset
}

type Other = { NOT_ENV: string }
`
    expect(declaredEnvKeys(source)).toEqual(['ASSETS', 'SNAPSHOTS', 'OG_METRICS'])
  })

  test('follows an intersection of two literals', () => {
    const source = 'export type Env = { A: string } & {\n  B?: number\n}\nconst x = { C: 1 }\n'
    expect(declaredEnvKeys(source)).toEqual(['A', 'B'])
  })

  test('null when the module exports no Env', () => {
    expect(declaredEnvKeys('export type Config = { A: string }')).toBeNull()
  })
})

describe('discoverWorkers', () => {
  test('finds the three Workers and skips srd, which has no script', () => {
    const apps = discoverWorkers().map((w) => w.app)
    expect(apps).toEqual(['discord-bot', 'itun', 'su-assets'])
  })
})
