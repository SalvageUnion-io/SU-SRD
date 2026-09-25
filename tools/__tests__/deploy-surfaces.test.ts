import { describe, expect, test } from 'bun:test'
import { decideSurfaces, SURFACES } from '../deploy-surfaces'

const EVERYTHING = { assets: true, srd: true, itun: true, bot: true }
const NOTHING = { assets: false, srd: false, itun: false, bot: false }

describe('deploy-surfaces — decideSurfaces', () => {
  test('no deploy record deploys every surface', () => {
    expect(decideSurfaces(null, false)).toEqual(EVERYTHING)
  })

  test('force_all deploys every surface even with nothing changed', () => {
    expect(decideSurfaces([], true)).toEqual(EVERYTHING)
  })

  test('nothing changed since the record deploys nothing', () => {
    expect(decideSurfaces([], false)).toEqual(NOTHING)
  })

  test('docs-only changes deploy nothing', () => {
    expect(decideSurfaces(['docs/architecture/ci.md', 'CLAUDE.md'], false)).toEqual(NOTHING)
  })

  /**
   * The CI-01 case. Commit A touched itun, commit B touched srd, and A's
   * deploy never ran. Diffing HEAD^..HEAD at B saw only srd; diffing from the
   * recorded deploy sees both.
   */
  test('changes from several commits since the record are all deployed', () => {
    const since = ['apps/itun/src/app.tsx', 'apps/srd/src/pages/index.page.tsx']
    expect(decideSurfaces(since, false)).toEqual({ ...NOTHING, itun: true, srd: true })
  })

  test.each(Object.entries(SURFACES))(
    'a change under apps/%s selects only that surface',
    (key, dir) => {
      const decision = decideSurfaces([`apps/${dir}/x.ts`], false)
      expect(decision).toEqual({ ...NOTHING, [key]: true })
    }
  )

  test.each([
    'packages/component-lib/src/index.ts',
    'packages/observability/src/cloudflare.ts',
    'test/happydom.ts',
    'package.json',
    'bun.lock',
    'bunfig.toml',
    'tsconfig.base.json',
    'patches/x.patch',
    '.bun-version',
    '.github/workflows/deploy-cloudflare.yml',
    // rendered into srd's about page and ITUN's bundle — the #731 shape
    'SPECIAL_THANKS.md',
    'ABOUT_JRVS.md',
    'LLM_STATEMENT.md',
  ])('a shared path (%s) deploys everything', (path) => {
    expect(decideSurfaces([path], false)).toEqual(EVERYTHING)
  })

  test('a directory that merely shares a prefix does not match', () => {
    // `apps/srd-legacy/` must not be read as `apps/srd/`.
    expect(decideSurfaces(['apps/srd-legacy/x.ts', 'apps/itun-docs/y.md'], false)).toEqual(NOTHING)
  })

  test('a root file that only starts like a shared one is not shared', () => {
    expect(decideSurfaces(['package.json.bak', 'bun.lockb.md'], false)).toEqual(NOTHING)
  })
})
