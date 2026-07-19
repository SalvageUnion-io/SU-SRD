import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Badge } from '../components/chrome/Badge'
import { ReferenceEntityCard } from '../components/referenceEntity/card/ReferenceEntityCard'
import { ReferenceEntityDisplay } from '../components/referenceEntity/card/referenceEntityDisplayShim'
import { DisplayView } from '../components/dashboard/DisplayView'
import type { ReferenceEntityControl } from '../components/referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'
import {
  deleteControl,
  selectControl,
} from '../components/referenceEntity/ReferenceEntityDisplay/referenceEntityControls'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Foundations/Entity Render Modes',
}

const noop = () => {}

// Real reference data drives every live cell (preloaded by .ladle/components.tsx).
const system = SalvageUnionReference.Systems.all()[0]
const equipment = SalvageUnionReference.Equipment.all()[0]
const gear = system ?? equipment
const gearName = gear?.name ?? 'System'

// ---------------------------------------------------------------------------
// A "mode" row: the mode/value, the component + prop/type it lives on, what it
// does, and a live render of it. `livesOn` is the whole point — it names the
// exact component + prop each mode is spelled on.
// ---------------------------------------------------------------------------
type ModeRow = {
  mode: string
  livesOn: string
  meaning: string
  example: ReactNode
}

function ModeGroup({
  home,
  typeName,
  blurb,
  rows,
}: {
  home: string
  typeName: string
  blurb: string
  rows: ModeRow[]
}) {
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <Badge shape="stamp" size="lg" as="span">
          {home}
        </Badge>
        <code className="rounded-badge bg-ink/8 px-1.5 py-0.5 font-mono text-[12px] text-ink">
          {typeName}
        </code>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">{blurb}</p>
      <div className="mt-4 flex flex-col gap-6">
        {rows.map((row) => (
          <div key={row.mode} className="border-t border-ink/12 pt-4">
            {/* Metadata line: the mode + the exact component · prop / type it lives on. */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <code className="rounded-badge bg-ink/8 px-1.5 py-0.5 text-[12px] font-bold text-ink">
                {row.mode}
              </code>
              <code className="text-[12px] text-ink-2">{row.livesOn}</code>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-ink-2">{row.meaning}</p>
            {/* The live render sits on its own full-width row so it renders naturally. */}
            <div className="mt-3">{row.example}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── 1. ReferenceEntityCard — the canonical density `size` ──────────────────
const cardSizeRows: ModeRow[] = [
  {
    mode: "size='full'",
    livesOn: 'ReferenceEntityCard · size',
    meaning: 'Dominant solo card — header + body + footer. The default at depth 0.',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="full" /> : null}
      </div>
    ),
  },
  {
    mode: "size='compact'",
    livesOn: 'ReferenceEntityCard · size',
    meaning: 'Reduced sizing/spacing. Nested entities are always compact.',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="compact" /> : null}
      </div>
    ),
  },
  {
    mode: "size='listing'",
    livesOn: 'ReferenceEntityCard · size',
    meaning:
      'Compact header treatment rendered as a solid full-colour domain row (name + description).',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="listing" /> : null}
      </div>
    ),
  },
  {
    mode: "size='badge'",
    livesOn: 'ReferenceEntityCard · size',
    meaning:
      'Shortform token — one tone-filled pill: type stamp, name, and TL / Tree · Level only.',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="badge" /> : null}
      </div>
    ),
  },
]

// ── 2. ReferenceEntityDisplay (compat shim) — legacy `mode` sugar ──────────
const sugarRows: ModeRow[] = [
  {
    mode: "mode='full'",
    livesOn: 'ReferenceEntityDisplay · mode',
    meaning: "Maps to size='full'.",
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityDisplay data={gear} mode="full" /> : null}
      </div>
    ),
  },
  {
    mode: "mode='compact'",
    livesOn: 'ReferenceEntityDisplay · mode',
    meaning: "Maps to size='compact'.",
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityDisplay data={gear} mode="compact" /> : null}
      </div>
    ),
  },
  {
    mode: "mode='head'",
    livesOn: 'ReferenceEntityDisplay · mode',
    meaning:
      "Legacy-only value. compact + listing → maps to size='listing'. (Dropped from the card's own size union.)",
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityDisplay data={gear} mode="head" /> : null}
      </div>
    ),
  },
  {
    mode: "mode='badge'",
    livesOn: 'ReferenceEntityDisplay · mode',
    meaning: "Maps to size='badge'.",
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityDisplay data={gear} mode="badge" /> : null}
      </div>
    ),
  },
]

// ── 3. ReferenceEntityCard — additive header/state modifiers ───────────────
const modifierRows: ModeRow[] = [
  {
    mode: 'lightweight',
    livesOn: 'ReferenceEntityCard · lightweight',
    meaning: 'Header renders title + controls only — no subtitle / stats / tech level.',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} lightweight /> : null}
      </div>
    ),
  },
  {
    mode: 'damaged / destroyed',
    livesOn: 'ReferenceEntityCard · damaged | destroyed',
    meaning:
      'Greys the header tone (sub-header + footer to darker greys). Threaded to nested cards.',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="compact" damaged /> : null}
      </div>
    ),
  },
  {
    mode: 'selected',
    livesOn: 'ReferenceEntityCard · selected',
    meaning: 'Rust selection ring; optional ok-tone "chosen" seal.',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="compact" selected /> : null}
      </div>
    ),
  },
  {
    mode: 'count',
    livesOn: 'ReferenceEntityCard · count / onCountChange',
    meaning: 'Quantity ≥ 1 reads as selected (rust ring) unless selected is set explicitly.',
    example: (
      <div className="max-w-xl">
        {gear ? (
          <ReferenceEntityCard data={gear} size="compact" count={2} onCountChange={noop} />
        ) : null}
      </div>
    ),
  },
  {
    mode: 'depth',
    livesOn: 'ReferenceEntityCard · depth',
    meaning:
      'Nesting level (0–3). Scales the title; past MAX_DEPTH (3) a card renders header-only.',
    example: (
      <span className="text-ink-2">— structural; set automatically by nested rendering</span>
    ),
  },
  {
    mode: 'dimHeader',
    livesOn: 'ReferenceEntityCard · dimHeader',
    meaning: 'Dims the header tone (a de-emphasised card) without the damaged grey.',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="compact" dimHeader /> : null}
      </div>
    ),
  },
]

// ── 4. ReferenceEntityControl — the card `controls` affordances ────────────
// Precedence when more than one field is set: stepper → badge → status → href → button.
const stepperControls: ReferenceEntityControl[] = [
  {
    key: 'q',
    stepper: { count: 3, onChange: noop, subject: gearName, min: 0, max: 5, label: 'Uses' },
  },
]
const badgeControls: ReferenceEntityControl[] = [
  {
    key: 'b',
    badge: (
      <Badge surface="tone" tone="bad">
        Used
      </Badge>
    ),
  },
]
const statusControls: ReferenceEntityControl[] = [
  { key: 's', status: { value: 'damaged', onClick: noop, subject: gearName } },
]
const hrefControls: ReferenceEntityControl[] = [
  { key: 'h', href: `/systems/${gear?.id ?? ''}`, label: 'View in SRD →' },
]
const buttonControls: ReferenceEntityControl[] = [
  { key: 'x', label: 'Install', onClick: noop, ariaLabel: 'Install', variant: 'primary' },
]
const factoryControls: ReferenceEntityControl[] = [selectControl(noop, true), deleteControl(noop)]

const controlRows: ModeRow[] = [
  {
    mode: 'stepper',
    livesOn: 'ReferenceEntityControl.stepper',
    meaning: 'Bounded −/readout/+ CountStepper (a quantity control). First in precedence.',
    example: (
      <div className="max-w-xl">
        {gear ? (
          <ReferenceEntityCard data={gear} size="compact" controls={stepperControls} />
        ) : null}
      </div>
    ),
  },
  {
    mode: 'badge',
    livesOn: 'ReferenceEntityControl.badge',
    meaning: 'Read-only status stamp (a Badge node) — e.g. "Used", "Uses 3/5".',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="compact" controls={badgeControls} /> : null}
      </div>
    ),
  },
  {
    mode: 'status',
    livesOn: 'ReferenceEntityControl.status',
    meaning: 'Condition StatusBadge (intact / damaged / destroyed) — the clickable cycle toggle.',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="compact" controls={statusControls} /> : null}
      </div>
    ),
  },
  {
    mode: 'href',
    livesOn: 'ReferenceEntityControl.href',
    meaning: 'Navigation link (styled anchor) — uses label as its text.',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="compact" controls={hrefControls} /> : null}
      </div>
    ),
  },
  {
    mode: 'button',
    livesOn: 'ReferenceEntityControl (label + onClick)',
    meaning:
      'Icon/label action button — the fallback when no item variant above is set. Last in precedence.',
    example: (
      <div className="max-w-xl">
        {gear ? <ReferenceEntityCard data={gear} size="compact" controls={buttonControls} /> : null}
      </div>
    ),
  },
  {
    mode: 'factory helpers',
    livesOn: 'selectControl / deleteControl / addControl / navigateControl',
    meaning:
      'Preset control builders. addControl / navigateControl are hidden + cardClick (whole-card click); select / delete are visible.',
    example: (
      <div className="max-w-xl">
        {gear ? (
          <ReferenceEntityCard data={gear} size="compact" controls={factoryControls} />
        ) : null}
      </div>
    ),
  },
]

// ── 5. DisplayView — ITUN Dashboard view-variants (DisplayContent union) ────
function boxed(node: ReactNode) {
  return (
    <div className="max-h-[32rem] w-full max-w-2xl overflow-auto border border-ink/15 bg-paper p-2">
      {node}
    </div>
  )
}

const displayRows: ModeRow[] = [
  {
    mode: "kind='note'",
    livesOn: "DisplayContent · { kind: 'note' }",
    meaning: 'A plain focus note (nothing statful selected).',
    example: <DisplayView content={{ kind: 'note', text: 'Nothing focused.' }} />,
  },
  {
    mode: "kind='slot'",
    livesOn: "DisplayContent · { kind: 'slot' }",
    meaning: 'An app-provided node (the store/rules-wired Actions deck).',
    example: (
      <DisplayView
        content={{ kind: 'slot', node: <Badge shape="stamp">app-provided node</Badge> }}
      />
    ),
  },
  {
    mode: "kind='entity'",
    livesOn: "DisplayContent · { kind: 'entity' }",
    meaning:
      'The focused entity as its reference card (via the shim), with play verbs as controls.',
    example: boxed(
      gear ? (
        <DisplayView
          content={{
            kind: 'entity',
            data: gear,
            note: '',
            controls: [{ key: 'sheet', href: `/sheet/system/${gear.id}`, label: 'Full sheet →' }],
          }}
        />
      ) : null
    ),
  },
  {
    mode: "kind='tables'",
    livesOn: "DisplayContent · { kind: 'tables' }",
    meaning:
      'The roll-tables view — category picker + a reused RollTable + ephemeral roll history.',
    example: boxed(<DisplayView content={{ kind: 'tables' }} />),
  },
  {
    mode: "kind='srd'",
    livesOn: "DisplayContent · { kind: 'srd' }",
    meaning: 'The in-panel SRD explorer.',
    example: boxed(<DisplayView content={{ kind: 'srd' }} />),
  },
]

/**
 * A 1:1 map of the render modes of `ReferenceEntityCard` and `DisplayView`
 * (component-lib) — grouped by the component (and exact prop / type) each mode
 * lives on:
 *   1. ReferenceEntityCard.size — the canonical density modes (full/compact/listing/badge)
 *   2. ReferenceEntityDisplay.mode — the legacy sugar shim onto the card (adds head; deleted at cutover)
 *   3. ReferenceEntityCard header/state modifiers (lightweight/damaged/selected/count/depth/dimHeader)
 *   4. ReferenceEntityControl — the card `controls` affordances (stepper→badge→status→href→button)
 *   5. DisplayView / DisplayContent — the ITUN Dashboard view-variants
 */
export const Default: Story = () => (
  <div className="bg-paper p-6 font-mono text-ink">
    <Badge shape="stamp" size="lg" as="span">
      Entity Render Modes
    </Badge>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
      <span className="font-bold text-ink">One map, every mode.</span> Each row is a distinct render
      mode of a reference entity, with a live example and the exact{' '}
      <span className="font-bold text-ink">component · prop / type</span> it lives on. The
      card&apos;s canonical vocabulary is <code className="text-ink">size</code>; the legacy{' '}
      <code className="text-ink">mode</code> sugar survives only on the compat shim.
    </p>

    <ModeGroup
      home="Card density"
      typeName="ReferenceEntityCard · size: ReferenceEntityCardSize"
      blurb="The canonical render mode. One prop, four densities. Nested entities are forced to 'compact'."
      rows={cardSizeRows}
    />
    <ModeGroup
      home="Legacy sugar"
      typeName="ReferenceEntityDisplay (compat shim) · mode: EntityDisplayMode"
      blurb="The pre-cutover call-sites still speak mode / compact / listing; the shim maps them onto size. mode adds 'head' (→ listing) and is deleted at cutover Stage d. Explicit compact / listing booleans win over mode."
      rows={sugarRows}
    />
    <ModeGroup
      home="Header / state"
      typeName="ReferenceEntityCard · additive modifiers"
      blurb="Additive to size — they reshape the header or tint the card rather than switching layout."
      rows={modifierRows}
    />
    <ModeGroup
      home="Controls"
      typeName="ReferenceEntityControl · the card's controls[] cluster"
      blurb="Every top-right card affordance is one ReferenceEntityControl. Each affordance is an optional field; when several are set they resolve by precedence: stepper → badge → status → href → button."
      rows={controlRows}
    />
    <ModeGroup
      home="Dashboard view"
      typeName="DisplayView · content: DisplayContent"
      blurb="ITUN's Dashboard display is a discriminated union of view-variants — not card modes, but the mode taxonomy one layer up. The 'entity' kind delegates back to the reference card."
      rows={displayRows}
    />
  </div>
)
