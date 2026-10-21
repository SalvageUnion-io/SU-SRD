import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseTsx, stringValues, unwrap } from '../lib/jsxTree'
import { ADAPTER, entityNesting, NESTED_GROUPS } from '../rules/entityNesting'
import { Exited, trapExit } from './trapExit'

/**
 * The `entity-nesting` rule set (`tools/check-rule-sets.ts`, the `styling`
 * check) fails a head-only Compact (N2), a titled box inside an entity (N5) and a
 * nested card below level 1 (N3). These run each rule against fixture trees:
 * the shapes the audit found must fail, and the shapes that fix them (a guard
 * on `onPage`, an early `nestsMinis` return, a Slab) must pass.
 */

const { errors } = trapExit()

/** This checkout's root: three levels above `packages/gates/__tests__/`. */
const ROOT = join(import.meta.dir, '..', '..', '..')

const temps: string[] = []
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

const C = 'apps/web/src/components'
const CARD = `${C}/referenceEntity/card`

/** An adapter whose head extent is the Mini (today's) or still a Compact (the audit's). */
const TOKEN_ADAPTER = 'export function ReferenceEntityCard() {\n  return <Mini />\n}\n'
const ROW_ADAPTER =
  'export function ReferenceEntityCard({ size }) {\n' +
  "  if (size === 'mini') return <Mini />\n" +
  '  return <Compact />\n' +
  '}\n'

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'nesting-'))
  temps.push(root)
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), contents)
  }
  return root
}

/** `file:line detail` for one rule's findings in a fixture tree. */
function found(rule: string, files: Record<string, string>): string[] {
  const results = entityNesting.scan(fixture(files))
  return (results[rule] ?? []).map((f) => `${f.file}:${f.line} ${f.detail}`)
}

describe('head-only-token (N2)', () => {
  const callers = {
    [`${CARD}/GuideSteps.tsx`]: [
      'export function GuideSteps({ NestedCard }) {',
      '  return <>',
      '    <NestedCard size="compact" extent="head" />',
      '    <NestedCard size="mini" extent="head" />',
      '    <NestedCard size="compact" extent="full" />',
      '  </>',
      '}',
    ].join('\n'),
    [`${C}/crawler/CrewStep.tsx`]:
      "export const CrewStep = ({ open }) => <ReferenceEntityCard size=\"compact\" extent={open ? 'full' : 'head'} />\n",
    [ADAPTER.replace('ReferenceEntityCard.tsx', 'Fold.tsx')]:
      "export function fold(size, extent, folded) {\n  return resolveCardDisplay({ size, extent: folded ? 'head' : extent })\n}\n",
  }

  test('while the adapter draws a Compact, every head that is not mini is a finding', () => {
    expect(found('head-only-token', { [ADAPTER]: ROW_ADAPTER, ...callers })).toEqual([
      `${C}/crawler/CrewStep.tsx:1 <ReferenceEntityCard extent="head"> without size="mini": the adapter draws it as a head-only Compact`,
      `${CARD}/Fold.tsx:2 a card display: extent "head" without size "mini", a head-only Compact`,
      `${CARD}/GuideSteps.tsx:3 <NestedCard extent="head"> without size="mini": the adapter draws it as a head-only Compact`,
      `${CARD}/ReferenceEntityCard.tsx:3 the adapter draws a Compact`,
    ])
  })

  test('once the adapter draws every head as a Mini, the callers pass', () => {
    expect(found('head-only-token', { [ADAPTER]: TOKEN_ADAPTER, ...callers })).toEqual([])
  })

  test('a Compact inside an entity fails; on a Page, in a dialog or outside the entity trees it passes', () => {
    const files = {
      [ADAPTER]: TOKEN_ADAPTER,
      [`${CARD}/NestedCards.tsx`]: [
        'function NestedRow({ data }) {',
        '  return <Entity size="compact" entity={data} />',
        '}',
        'function PageRows({ host, data }) {',
        '  return host.onPage && <Entity size="compact" entity={data} />',
        '}',
        'function Opened({ data }) {',
        '  return <Dialog.Portal><Entity size="compact" entity={data} /></Dialog.Portal>',
        '}',
        'function Minied({ data }) {',
        '  return <Entity size="mini" entity={data} />',
        '}',
      ].join('\n'),
      [`${C}/entity/PeekCard.tsx`]: 'export const PeekCard = () => <Compact />\n',
      [`${C}/entity/Entity.tsx`]: 'export function Entity() {\n  return <Compact />\n}\n',
      [`${C}/entity/forms/Mini.tsx`]: 'export const Mini = () => <Compact />\n',
      [`${C}/sheet/PilotSheetItems.tsx`]: 'export const Item = () => <Entity size="compact" />\n',
      [`${CARD}/CardPage.tsx`]: 'export const CardPage = () => <Entity size="compact" />\n',
    }
    expect(found('head-only-token', files)).toEqual([
      `${C}/entity/PeekCard.tsx:1 a Compact inside an entity`,
      `${CARD}/NestedCards.tsx:2 a Compact inside an entity`,
    ])
  })
})

describe('no-titled-box (N5)', () => {
  const titled = {
    [`${C}/containers/Inset.tsx`]: 'export function Inset() {\n  return <TitledBox />\n}\n',
    [`${C}/entity/InfoCutout.tsx`]: 'export function InfoCutout() {\n  return <TitledBox />\n}\n',
    [`${C}/containers/ModalShell.tsx`]:
      'export function ModalShell({ children }) {\n  return <Dialog.Portal><TitledBox>{children}</TitledBox></Dialog.Portal>\n}\n',
    [`${C}/sheet/NpcInset.tsx`]: 'export function NpcInset() {\n  return <Inset />\n}\n',
    [`${C}/npc/LinkedCrewInset.tsx`]:
      'export function LinkedCrewInset() {\n  return <div><NpcInset /></div>\n}\n',
  }

  test("a titled box in an entity's own component fails unless it is the Page's (onPage)", () => {
    const files = {
      ...titled,
      [`${CARD}/DamagedEffect.tsx`]: [
        'export function Damaged({ onPage }) {',
        '  if (onPage) {',
        '    return <TitledBox title="When Damaged" />',
        '  }',
        '  return <Slab label="When Damaged" />',
        '}',
        'export function Boxed() {',
        '  return <TitledBox title="When Damaged" />',
        '}',
      ].join('\n'),
      [`${CARD}/Notes.tsx`]: [
        'export const Note = () => <Callout>a note</Callout>',
        'export const Titled = () => <Callout label="Reminder">a note</Callout>',
        'export const Unset = () => <Callout label={undefined}>a note</Callout>',
        "export const Page = ({ presentation }) => presentation === 'page' ? <Inset /> : null",
      ].join('\n'),
      [`${C}/wizard/Step.tsx`]: 'export const Step = () => <TitledBox title="Step" />\n',
    }
    expect(found('no-titled-box', files)).toEqual([
      `${CARD}/DamagedEffect.tsx:8 a TitledBox drawn in an entity's own component`,
      `${CARD}/Notes.tsx:2 a labelled Callout drawn in an entity's own component`,
    ])
  })

  test("a titled box reaching a card's slot fails, through locals and components", () => {
    const files = {
      ...titled,
      [`${C}/sheet/BayCard.tsx`]: [
        'export function BayCard({ assigned, contents }) {',
        '  const inline = <NpcInset />',
        '  const crew = assigned ? <LinkedCrewInset /> : inline',
        '  return (',
        '    <ReferenceEntityCard',
        '      expand={<div>{contents}{crew}</div>}',
        '      afterExtraContent={<Callout label="Hold">cargo</Callout>}',
        '    />',
        '  )',
        '}',
      ].join('\n'),
    }
    expect(found('no-titled-box', files)).toEqual([
      `${C}/sheet/BayCard.tsx:3 LinkedCrewInset, which draws a titled box in <ReferenceEntityCard>'s \`expand\` slot`,
      `${C}/sheet/BayCard.tsx:2 NpcInset, which draws a titled box in <ReferenceEntityCard>'s \`expand\` slot`,
      `${C}/sheet/BayCard.tsx:7 a labelled Callout in <ReferenceEntityCard>'s \`afterExtraContent\` slot`,
    ])
  })

  test('a slot passes on a Page, through a dialog, and for a box drawn only on a Page', () => {
    const files = {
      ...titled,
      [`${CARD}/DamagedEffectCallout.tsx`]:
        'export function DamagedEffectCallout({ onPage }) {\n  return onPage ? <TitledBox /> : <Slab />\n}\n',
      [`${CARD}/Sections.tsx`]:
        'export function Sections({ onPage }) {\n  return <DamagedEffectCallout onPage={onPage} />\n}\n',
      [`${C}/sheet/Picker.tsx`]:
        'export function Picker() {\n  return <ModalShell><Inset /></ModalShell>\n}\n',
      [`${C}/sheet/Cards.tsx`]: [
        'export function Cards() {',
        '  return <>',
        '    <ReferenceEntityCard presentation="page" afterExtraContent={<Inset />} />',
        '    <ReferenceEntityCard expand={<Picker />} />',
        '    <ReferenceEntityCard expand={<><DamagedEffectCallout /><Sections /></>} />',
        '    <ReferenceEntityCard expand={<DamagedEffectCallout onPage />} />',
        '  </>',
        '}',
      ].join('\n'),
    }
    expect(found('no-titled-box', files)).toEqual([
      `${C}/sheet/Cards.tsx:6 DamagedEffectCallout, which draws a titled box in <ReferenceEntityCard>'s \`expand\` slot`,
    ])
  })
})

describe('nested-card-level (N3)', () => {
  test('a NestedCard below level 1 fails; after a Mini return, on a Page or as a Page it passes', () => {
    const files = {
      [NESTED_GROUPS]: [
        'export function InlineActions({ actions, host }) {',
        '  const { NestedCard } = host',
        '  return actions.map((a) => <NestedCard data={a} />)',
        '}',
        'function NestedCardList({ entities, host }) {',
        '  const { NestedCard } = host',
        '  if (useContext(InsidePeekContext)) return <PeekMinis />',
        '  if (nestsMinis(host)) return <NestedMinis />',
        '  return entities.map((e) => <NestedCard data={e} />)',
        '}',
        'function Ternary({ host, data }) {',
        '  const { NestedCard } = host',
        '  return host.onPage ? <NestedCard data={data} /> : <NestedMinis />',
        '}',
        'function Depth({ host, data }) {',
        '  const { NestedCard } = host',
        '  return host.depth >= 1 ? <NestedRow /> : <NestedCard data={data} />',
        '}',
        'function Opened({ host, data }) {',
        '  const { NestedCard } = host',
        '  return <>',
        '    <NestedCard data={data} presentation="page" />',
        '    <NestedCard data={data} size="mini" extent="head" />',
        '  </>',
        '}',
      ].join('\n'),
    }
    expect(found('nested-card-level', files)).toEqual([
      `${NESTED_GROUPS}:3 a NestedCard drawn below level 1 (in InlineActions)`,
      `${NESTED_GROUPS}:17 a NestedCard drawn below level 1 (in Depth)`,
    ])
  })

  test('the page guard reads !, && and ||, and a local alias', () => {
    const files = {
      [NESTED_GROUPS]: [
        'function A({ host, data, open }) {',
        '  const { NestedCard } = host',
        '  const tokens = nestsMinis(host)',
        '  if (open || tokens) return null',
        '  return <NestedCard data={data} />',
        '}',
        'function B({ host, data, open }) {',
        '  const { NestedCard } = host',
        '  return !(open && !host.onPage) ? <NestedCard data={data} /> : null',
        '}',
        'function C({ host, data, open }) {',
        '  const { NestedCard } = host',
        '  return (open && host.onPage) && <NestedCard data={data} />',
        '}',
        'function D({ host, data }) {',
        '  const { NestedCard } = host',
        '  return (nestsMinis(host) || host.onPage) ? null : <NestedCard data={data} />',
        '}',
        'function E({ host, data }) {',
        '  const { NestedCard } = host',
        '  return host.flag ?? <NestedCard data={data} />',
        '}',
      ].join('\n'),
    }
    expect(found('nested-card-level', files)).toEqual([
      `${NESTED_GROUPS}:9 a NestedCard drawn below level 1 (in B)`,
      `${NESTED_GROUPS}:21 a NestedCard drawn below level 1 (in E)`,
    ])
  })
})

describe('named-block (R18)', () => {
  const RENDERER = `${CARD}/whenDamaged.model.ts`
  const renderer = 'export const damagedEffectOf = (e) => e.damagedEffect\n'

  test("a module other than the block's renderer reading its field fails", () => {
    expect(
      found('named-block', {
        [RENDERER]: renderer,
        [`${CARD}/cardBodyProse.tsx`]:
          "const a = 'damagedEffect' in entity ? entity.damagedEffect : undefined\n",
        'apps/web/src/build/sheet/Bay.ts': 'export const t = (bay as any)?.damagedEffect\n',
      })
    ).toEqual([
      "apps/web/src/build/sheet/Bay.ts:1 reads `damagedEffect` off an entity outside its block's model (whenDamaged.model.ts)",
      `${CARD}/cardBodyProse.tsx:1 reads \`damagedEffect\` off an entity outside its block's model (whenDamaged.model.ts)`,
    ])
  })

  test('the renderer, a hide flag, a key, a comment and a test pass', () => {
    expect(
      found('named-block', {
        [RENDERER]: renderer,
        [`${CARD}/cardSections.tsx`]:
          'const show = !hide?.damagedEffect && !!damagedEffectOf(entity)\nconst HIDE = { damagedEffect: true }\n// reads entity.damagedEffect\n',
        [`${CARD}/__tests__/a.test.ts`]: 'expect(bay.damagedEffect).toBe(1)\n',
      })
    ).toEqual([])
  })
})

describe('the corpus', () => {
  test('tests are not components; the summary counts both trees', () => {
    const root = fixture({
      [`${CARD}/__tests__/A.test.tsx`]: 'export const A = () => <TitledBox />\n',
      [`${CARD}/B.tsx`]: 'export const B = () => <Slab />\n',
      [`${C}/sheet/C.tsx`]: 'export const C = () => <Slab />\n',
    })
    expect(entityNesting.scan(root)['no-titled-box']).toEqual([])
    expect(entityNesting.summary?.(root)).toBe('2 components, 1 in the entity trees')
  })

  test('stringValues follows conditionals to their literals and says when it cannot', () => {
    const expr = (src: string) => {
      const { program } = parseTsx('x.tsx', `const v = ${src}`)
      const body = program.body as { declarations: { init: Parameters<typeof unwrap>[0] }[] }[]
      return unwrap(body[0]?.declarations[0]?.init as Parameters<typeof unwrap>[0])
    }
    expect(stringValues(expr("open ? 'full' : 'head'"))).toEqual({
      values: ['full', 'head'],
      open: false,
    })
    expect(stringValues(expr("(size as string) || 'mini'"))).toEqual({
      values: ['mini'],
      open: true,
    })
    expect(stringValues(null)).toEqual({ values: [], open: true })
  })
})

describe('entity-nesting preflight', () => {
  test('an empty tree trips the first floor instead of passing', () => {
    const root = fixture({})
    expect(() => entityNesting.preflight?.(root)).toThrow(new Exited(1))
    expect(errors.join('\n')).toContain('entity-nesting (components): scanned 0 files')
  })

  test('this checkout passes every floor and coverage assertion', () => {
    expect(() => entityNesting.preflight?.(ROOT)).not.toThrow()
    expect(errors).toEqual([])
  })
})
