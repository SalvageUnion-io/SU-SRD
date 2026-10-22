import type { Page } from '@playwright/test'

/**
 * The nesting law (ruleset §5, N1–N7; EDL E6) as the rendered page draws it.
 * `findNestingFindings` reads the page and returns every place it breaks:
 *
 * - **N1** a headed frame at level 2 or deeper. Level 0 is the page box (a
 *   Page, a dialog, a wizard step, the Peek plate), which draws no entity head
 *   of its own: a dialog's cut-out head is its chrome, so it is level 0 too.
 *   Every headed frame around a frame adds a level, so a Page's Card is 1 and
 *   a Compact inside it 2.
 * - **N3** an entity inside a Mini: a Mini nests nothing (E6), bar a crawler
 *   bay (R46, `n3Except`).
 * - **N4** a Mini narrower than its line, by more than a pixel: one Mini a
 *   line, filling it. In a two-up list (a pattern drone's parts) and a
 *   masonry grid of contentful Minis (`MiniGrid`) each column is a line, as
 *   a sheet's sidebar is.
 * - **N5** a TitledBox (a `Box` with a head) inside an entity's frame.
 * - **N6** a TitledBox inside a wizard step around the step's entities.
 * - **N7** a Mini in select mode (a radio, a checkbox, a pressed toggle):
 *   select is a Compact's or a Card's, never a Mini's. The one exception is an
 *   in-card entity choice (`ChoiceRegion`): its Mini is a toggle, pressed when
 *   chosen, under a `data-choice-toggle` parent; a radio or checkbox there
 *   still breaks N7.
 * - **N8** a Mini one level deep on an entity's or a guide's Page (`oneDeep`):
 *   an entity nested one level deep is a Compact drawn open with all its content,
 *   never a Mini (EDL E6, R39: a bay's Smith, a guide's
 *   options). A Mini level 2 or deeper, in a search list or on a Peek's
 *   plate is no N8, and neither is one in the named exception (`n8Except`;
 *   R39): a pattern's loadout on a chassis's
 *   or a pattern's Page, and a class's ability trees.
 *
 * A headed frame is the frame around a visible `Head` band (`Head`: Compact, Card
 * and TitledBox alike) or a CompactIndex's band; its name is the title on the band,
 * which ends in the kind its `KindLabel` reads (`Shield Drone (Drone)`).
 * Subtrees hidden from assistive tech (`aria-hidden`, `inert`: the page under
 * a modal dialog) are not read.
 *
 * Layout decides two of these, visibility and N4's widths, so only a browser
 * measures them; the structure (N1, N3, N5, N6, N7) holds in any DOM.
 */
export type NestingFinding = {
  rule: 'N1' | 'N3' | 'N4' | 'N5' | 'N6' | 'N7' | 'N8'
  /** The headed frames from the outermost in, `Bay (Crawler Bay) > When Damaged (TitledBox)`. */
  chain: string
  /** What breaks the rule there: `a headed frame at level 2`, `312px on a 480px line`. */
  detail: string
}

/** The class names the forms draw (`entity/parts/Head.tsx`, `entity/forms/*`, `containers/Box.tsx`). */
export type NestingSelectors = {
  /** A head band: every `Head`, a CompactIndex's band, a choice option's head on its Page (`ChoiceGroups`). */
  head: string
  /**
   * The frame a head names, nearest first: a Compact's or Box's, a Card's, a
   * CompactIndex's, a choice option's.
   */
  frame: string
  /** The title inside a head. */
  title: string
  /** The class on a `Box`'s root: a head inside it makes a TitledBox. */
  box: string
  /** A dialog's own TitledBox (`ModalShell`): its head is level 0 chrome. */
  chrome: string
  /** A Mini, header-only or contentful. */
  token: string
  /** A Mini's name (its `KindLabel` inside). */
  tokenName: string
  /** The parent of an in-card entity choice's Mini, the toggle N7 allows. */
  choiceToggle: string
  /** A wizard step's region (`WizShell`). */
  step: string
  /** A two-up Mini list (EDL E3): each of its columns is a line. */
  twoUp: string
  /** A masonry grid of contentful Minis (`MiniGrid`, EDL E3): each of its columns is a line. */
  miniGrid: string
  /** A live sheet's columns (`SheetColumns`): its main column and its sidebar are each a line. */
  sheetColumns: string
  /** How many px narrower than its line a Mini may be. */
  tolerance: number
  /**
   * Where a Mini one level deep breaks N8 (an entity's or a guide's Page:
   * its `main`), or null where Minis at level 1 are the form (a sheet, Play,
   * a wizard).
   */
  oneDeep: string | null
  /** What inside `oneDeep` is no nesting: a search's list, a Peek's plate, a dialog. */
  notNested: string
  /**
   * N8's named exception (EDL E6): a pattern's loadout
   * (`PatternLoadout`, on a chassis's Page and a pattern's) and a class's
   * ability trees (`ClassAbilityTree`) keep their Minis one level deep.
   */
  n8Except: string
  /**
   * N3's named exception (R46): a crawler bay (the Mini its `MiniGroup` holds)
   * is a contentful Mini whose body holds its choices, roll table, what it
   * holds and its crew lead's Mini.
   */
  n3Except: string
}

export const NESTING_SELECTORS: NestingSelectors = {
  head: '.su-entity-compact__head, .su-entity-index__band',
  frame: '.su-entity-compact__frame, .su-ec-frame, .su-entity-index__frame',
  title: '.su-entity-compact__title, .su-entity-index__name',
  box: 'su-box',
  chrome: '.su-modal-panel',
  token: '.su-entity-mini',
  tokenName: '.su-entity-mini__name',
  choiceToggle: '[data-choice-toggle]',
  step: '.su-wiz-main',
  twoUp: '.su-entity-mini-list--two-up',
  miniGrid: '.su-mini-grid',
  sheetColumns: '.su-sheet-columns',
  tolerance: 1,
  oneDeep: null,
  notNested: '[role="listbox"], [data-peek-popup], [role="dialog"]',
  n8Except:
    '.su-pattern-loadout, .su-entity-page__loadout, .su-ability-tree, .su-entity-page__neighbours',
  n3Except: '.su-mini-group > .su-entity-mini',
}

/**
 * Runs in the page and returns plain data, so it closes over nothing: every
 * helper is declared inside it, and the selectors come in as its argument.
 */
export function scanNesting(a: NestingSelectors): NestingFinding[] {
  type Frame = { el: Element; kind: 'entity' | 'box' | 'chrome'; name: string }
  const px = (v: string) => Number.parseFloat(v) || 0
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const visible = (el: Element) => {
    if (el.closest('[aria-hidden="true"], [inert]')) return false
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity || 1) > 0.05
  }

  // Every headed frame, once (a frame names its first visible head).
  const frames: Frame[] = []
  const framed = new Set<Element>()
  for (const head of document.querySelectorAll(a.head)) {
    if (!visible(head)) continue
    const el = head.closest(a.frame) ?? head
    if (framed.has(el)) continue
    framed.add(el)
    const root = el.parentElement
    const kind = root?.classList.contains(a.box)
      ? root.matches(a.chrome)
        ? 'chrome'
        : 'box'
      : 'entity'
    const title = text(head.querySelector(a.title)) || text(head).slice(0, 40) || '(untitled)'
    const name =
      kind === 'chrome' ? `${title} (dialog)` : kind === 'box' ? `${title} (TitledBox)` : title
    frames.push({ el, kind, name })
  }
  /** The headed frames around `el`, outermost first. */
  const around = (el: Element) =>
    frames
      .filter((f) => f.el !== el && f.el.contains(el))
      .sort((x, y) => (x.el.contains(y.el) ? -1 : 1))
  const chainOf = (outer: Frame[], last: string) => [...outer.map((f) => f.name), last].join(' > ')
  const tokens = [...document.querySelectorAll(a.token)].filter(visible)
  const tokenName = (t: Element) => text(t.querySelector(a.tokenName)) || '(Mini)'

  const found: NestingFinding[] = []
  for (const f of frames) {
    if (f.kind === 'chrome') continue
    const outer = around(f.el)
    const chain = chainOf(outer, f.name)
    const level = outer.filter((g) => g.kind !== 'chrome').length + 1
    if (level >= 2) found.push({ rule: 'N1', chain, detail: `a headed frame at level ${level}` })
    if (f.kind !== 'box') continue
    if (outer.some((g) => g.kind === 'entity'))
      found.push({ rule: 'N5', chain, detail: 'a TitledBox inside an entity' })
    const holdsEntities =
      frames.some((g) => g.kind === 'entity' && f.el.contains(g.el)) ||
      tokens.some((t) => f.el.contains(t))
    if (f.el.closest(a.step) && holdsEntities)
      found.push({ rule: 'N6', chain, detail: "a TitledBox around a wizard step's entities" })
  }

  // N3: a Mini nests nothing, bar a crawler bay (R46).
  for (const t of tokens) {
    if (t.matches(a.n3Except)) continue
    const inner = [
      ...frames.filter((f) => t.contains(f.el)).map((f) => f.name),
      ...tokens.filter((o) => o !== t && t.contains(o)).map(tokenName),
    ]
    for (const name of inner)
      found.push({
        rule: 'N3',
        chain: chainOf(around(t), `${tokenName(t)} > ${name}`),
        detail: 'an entity inside a Mini',
      })
  }

  // N7: a Mini takes no select mode, on its surface or its contentful head,
  // bar an in-card choice's toggle: pressed, never a radio or a checkbox.
  const pick = '[role="radio"], [role="checkbox"], [aria-checked]'
  const select = `${pick}, [aria-pressed]`
  for (const t of tokens) {
    const head = t.querySelector(':scope > .su-entity-mini__head')
    const toggle = !!t.parentElement?.matches(a.choiceToggle)
    const rule = toggle ? pick : select
    if (t.matches(rule) || head?.matches(rule))
      found.push({
        rule: 'N7',
        chain: chainOf(around(t), tokenName(t)),
        detail: 'a Mini in select mode',
      })
  }

  // N8: one level deep on a Page, an entity is a Compact drawn open, never a Mini.
  if (a.oneDeep) {
    for (const t of tokens) {
      if (!t.closest(a.oneDeep) || t.closest(a.notNested) || t.closest(a.n8Except)) continue
      // A section's TitledBox frames no entity: a Mini in one is still one deep.
      if (around(t).some((f) => f.kind === 'entity')) continue
      found.push({
        rule: 'N8',
        chain: chainOf(around(t), tokenName(t)),
        detail: 'a Mini one level deep: a Compact drawn open with all its content',
      })
    }
  }

  // N4: a Mini fills its line. Its line is its parent's content box, less
  // whatever else sits on the same row; a wrapper holding only the Mini (a
  // list item) must fill its own line in turn, unless it stands at its own
  // max-width: a measure (a Page's sections at 52rem) is the line there.
  const layoutParent = (el: Element) => {
    let p = el.parentElement
    while (p && getComputedStyle(p).display === 'contents') p = p.parentElement
    return p
  }
  const layoutKids = (p: Element): Element[] =>
    [...p.children].flatMap((c) =>
      getComputedStyle(c).display === 'contents' ? layoutKids(c) : [c]
    )
  const inFlow = (el: Element) => !/absolute|fixed/.test(getComputedStyle(el).position)
  const outerWidth = (el: Element) => {
    const s = getComputedStyle(el)
    return el.getBoundingClientRect().width + px(s.marginLeft) + px(s.marginRight)
  }
  const sameRow = (x: DOMRect, y: DOMRect) =>
    Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) >= 0.5 * Math.min(x.height, y.height)
  /** The N4 detail for `t`, or nothing when it fills its line. */
  const shortfall = (t: Element): string | undefined => {
    let el = t
    for (let up = 0; up < 4; up++) {
      const p = layoutParent(el)
      if (!p) return undefined
      const ps = getComputedStyle(p)
      // A masonry grid's line is its column, and a multi-column flow gives
      // each item its column's whole width: the Mini filled its item below.
      if (p.matches(a.miniGrid)) return undefined
      // A sheet's sidebar is a column of the page, a line of its own beside
      // the main column: what fills the sidebar fills its line.
      if (p.matches(a.sheetColumns)) return undefined
      // A two-up list's line is its column: the item must fill its track.
      if (p.matches(a.twoUp)) {
        const track = px(ps.gridTemplateColumns.split(' ')[0] ?? '')
        const width = outerWidth(el)
        return track - width > a.tolerance
          ? `${Math.round(t.getBoundingClientRect().width)}px on a ${Math.round(track)}px column`
          : undefined
      }
      const room = p.clientWidth - px(ps.paddingLeft) - px(ps.paddingRight)
      const box = el.getBoundingClientRect()
      const others = layoutKids(p).filter((k) => k !== el && visible(k) && inFlow(k))
      const row = others.filter((k) => sameRow(box, k.getBoundingClientRect()))
      if (row.some((k) => k.matches(a.token) || k.querySelector(a.token)))
        return 'shares its line with another Mini'
      const gaps = /flex|grid/.test(ps.display) ? px(ps.columnGap) * row.length : 0
      const free = room - gaps - row.reduce((sum, k) => sum + outerWidth(k), 0)
      if (free - outerWidth(el) > a.tolerance)
        return `${Math.round(t.getBoundingClientRect().width)}px on a ${Math.round(free)}px line`
      if (others.length > 0) return undefined
      // A percentage stays one in the computed style: only a length caps.
      const cap = ps.maxWidth.endsWith('px') ? px(ps.maxWidth) : 0
      if (cap > 0 && p.getBoundingClientRect().width >= cap - a.tolerance) return undefined
      el = p
    }
    return undefined
  }
  for (const t of tokens) {
    const detail = shortfall(t)
    if (detail) found.push({ rule: 'N4', chain: chainOf(around(t), tokenName(t)), detail })
  }
  return found
}

/** Every finding on the page; `oneDeep` (an entity's or a guide's Page) adds N8. */
export function findNestingFindings(
  page: Page,
  { oneDeep = false }: { oneDeep?: boolean } = {}
): Promise<NestingFinding[]> {
  return page.evaluate(scanNesting, { ...NESTING_SELECTORS, oneDeep: oneDeep ? 'main' : null })
}

/** One line per distinct finding, with how many times the page draws it. */
export function describeFindings(where: string, findings: NestingFinding[]): string[] {
  const counts = new Map<string, number>()
  for (const f of findings) {
    const line = `${where}: ${f.rule} ${f.chain}: ${f.detail}`
    counts.set(line, (counts.get(line) ?? 0) + 1)
  }
  return [...counts].map(([line, n]) => (n > 1 ? `${line} (×${n})` : line))
}
