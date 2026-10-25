import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { migrate, migrationConfig } from '../d1-migrate'

/** d1-migrate: create the shared database once, then apply what it has not had. */

type Call = string[]

function wrangler(answers: Record<string, { exitCode: number; stderr?: string }>) {
  const calls: Call[] = []
  const configs: unknown[] = []
  const run = async (args: string[]) => {
    calls.push(args)
    const config = args[args.indexOf('--config') + 1]
    if (args.includes('--config') && config) configs.push(JSON.parse(readFileSync(config, 'utf8')))
    const answer = answers[args.slice(0, 2).join(' ')] ?? { exitCode: 0 }
    return { exitCode: answer.exitCode, stdout: '', stderr: answer.stderr ?? '' }
  }
  return { run, calls, configs }
}

describe('d1-migrate', () => {
  it('applies migrations to a database that exists, naming it alone', async () => {
    const fake = wrangler({})
    await migrate('su-shared-preview', fake.run)
    expect(fake.calls.map((c) => c.slice(0, 3).join(' '))).toEqual([
      'd1 info su-shared-preview',
      'd1 migrations apply',
    ])
    expect(fake.configs).toEqual([migrationConfig('su-shared-preview')])
  })

  it('creates the database on the first run', async () => {
    const fake = wrangler({
      'd1 info': { exitCode: 1, stderr: "Couldn't find a D1 DB named 'su-shared'" },
    })
    await migrate('su-shared', fake.run)
    expect(fake.calls.map((c) => c.slice(0, 2).join(' '))).toEqual([
      'd1 info',
      'd1 create',
      'd1 migrations',
    ])
  })

  it('stops on anything else, and touches no other database', async () => {
    const denied = wrangler({ 'd1 info': { exitCode: 1, stderr: 'Authentication error' } })
    await expect(migrate('su-shared', denied.run)).rejects.toThrow('could not read')
    const failed = wrangler({ 'd1 migrations': { exitCode: 1, stderr: 'syntax error' } })
    await expect(migrate('su-shared', failed.run)).rejects.toThrow('migrations failed')
    await expect(migrate('production-db', wrangler({}).run)).rejects.toThrow('not one of')
  })
})
