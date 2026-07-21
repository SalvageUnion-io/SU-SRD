/**
 * TEMPORARY review aid for PR 466 — one row per change from the design-system
 * sizing/vocabulary session, so the whole set can be screenshot-reviewed in a
 * single scroll. Every specimen renders real SRD data through the production
 * components, and every swatch resolves `var(--color-*)` — never a hardcoded
 * hex (the old Theme page hardcoded values and drifted in ten places; that is
 * the exact bug this session fixed).
 *
 * SAFE TO DELETE after review: nothing imports it, and removing it only
 * requires dropping 'ChangeReview' from CATALOG_PAGES in story-coverage.test.ts.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Caption } from './_harness'
import { Text } from '../components/base/Text'
import { Badge } from '../components/chrome/Badge'
import { Button } from '../components/chrome/Button'
import { Callout } from '../components/chrome/Callout'
import { ConditionChip } from '../components/chrome/Conditions'
import { EmptyState } from '../components/chrome/EmptyState'
import { InlineRef } from '../components/chrome/InlineRef'
import { Slab } from '../components/chrome/Slab'
import { EntityTooltip } from '../components/referenceEntity/EntityTooltip'
import { ReferenceEntityCard } from '../components/referenceEntity/card/ReferenceEntityCard'
import { EntityGrid } from '../components/shared/EntityGrid'
import { Inset } from '../components/shared/Inset'
import { ModalShell } from '../components/shared/ModalShell'
import { RollTable } from '../components/shared/RollTable'
import { SlotGrid } from '../components/shared/SlotGrid'
import { Stat } from '../components/shared/Stat'
import { Skeleton } from '../components/skeleton/Skeleton'
import { VitalGauge } from '../components/stat/VitalGauge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Foundations/Change Review',
}

/* Real SRD fixtures (the preload gate in .ladle/components.tsx resolves before
 * this chunk imports, so top-level reads are safe — same as every story). */
const chassis = SalvageUnionReference.Chassis.all()[0]
const system = SalvageUnionReference.Systems.all()[0]
const naniteSifter = SalvageUnionReference.Systems.find((s) => s.name === 'Nanite Sifter')
const bionicArms = SalvageUnionReference.Modules.find((m) => m.name === 'Bionic Arms')
const coolantFlush = SalvageUnionReference.Abilities.find((a) => a.name === 'Coolant Flush')
const creature = SalvageUnionReference.Creatures.all()[0]
const villageCrawler = SalvageUnionReference.CrawlerTechLevels.find(
  (t) => t.name === 'Village Crawler'
)
const rollTableEntity = SalvageUnionReference.RollTables.all()[0]
const rollTable = rollTableEntity && 'table' in rollTableEntity ? rollTableEntity.table : undefined

/** One review row: what changed (caption), why (prose), the living specimen. */
function Row({ title, why, children }: { title: string; why: string; children: ReactNode }) {
  return (
    <section className="border-chrome border-ink/15 border-t pt-4 pb-2">
      <Caption>{title}</Caption>
      <p className="mb-3 max-w-prose font-body text-caption text-wk-muted">{why}</p>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  )
}

/** A token swatch resolved from the live custom property — never a hex copy. */
function Swatch({ token }: { token: string }) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span
        className="inline-block h-10 w-16 rounded-card border-chrome border-ink"
        style={{ background: `var(${token})` }}
      />
      <code className="font-mono text-note text-ink">{token}</code>
    </span>
  )
}

/** The SelectorDialog / DeleteConfirmDialog merge, live: ModalShell's `tone`. */
function ModalToneDemo() {
  const [open, setOpen] = useState<'action' | 'danger' | null>(null)
  return (
    <>
      <Button onClick={() => setOpen('action')}>Open action modal</Button>
      <Button variant="danger" onClick={() => setOpen('danger')}>
        Open danger modal
      </Button>
      {open && (
        <ModalShell
          open
          onOpenChange={(next) => !next && setOpen(null)}
          title={open === 'danger' ? 'Delete Mech' : 'Add System'}
          tone={open}
        >
          <div className="p-4">
            <Text variant="body">
              {open === 'danger'
                ? 'Destructive confirms render the status-bad header.'
                : 'Constructive flows render the pilot-blue header.'}
            </Text>
          </div>
        </ModalShell>
      )}
    </>
  )
}

/**
 * PR 466 change review — one row per change, top to bottom: tokens, the
 * danger consolidation, the sizing ladder, Stat's display rung, the adopted
 * orphans, the component merges, the fixed card bugs, and the dense tooltip.
 */
export const Default: Story = () => (
  <div className="max-w-5xl space-y-4">
    <div>
      <h2 className="mb-1 font-cond text-lede font-bold uppercase tracking-caps text-ink">
        PR 466 — change review
      </h2>
      <p className="max-w-prose font-body text-caption text-wk-muted">
        Temporary catalog page: every change from this session as a living specimen, rendered from
        production components and real SRD data.
      </p>
    </div>

    {/* ------------------------------- TOKENS ------------------------------- */}
    <Row
      title="token · --color-adversary"
      why="The 5th ontology domain — creatures, bio-titans, factions, NPCs, meld, squads. Formerly misnamed su-rust, which collided with the action colour."
    >
      <Swatch token="--color-adversary" />
      {creature && <ReferenceEntityCard data={creature} size="small" extent="head" />}
    </Row>

    <Row
      title="token · --color-tier-core"
      why="The core-rulebook tier hue, promoted to a named token instead of an inline literal."
    >
      <Swatch token="--color-tier-core" />
      <Swatch token="--color-tier-core-pale" />
    </Row>

    <Row
      title="token · --color-band-cream"
      why="The ONE sanctioned cream — RollTable row banding only. Visible in the roll-table specimens further down."
    >
      <Swatch token="--color-band-cream" />
    </Row>

    <Row
      title="token · ink-opacity ramp"
      why="ink-75 / 50 / 30 / 12 / 8 — a single ink at five opacities replaces the drifting neutral greys."
    >
      <Swatch token="--color-ink-75" />
      <Swatch token="--color-ink-50" />
      <Swatch token="--color-ink-30" />
      <Swatch token="--color-ink-12" />
      <Swatch token="--color-ink-8" />
    </Row>

    <Row
      title="token · --color-caution"
      why="Renamed from su-sickly-yellow into the closed colour set."
    >
      <Swatch token="--color-caution" />
    </Row>

    <Row title="token · --color-inert" why="Renamed from su-silver into the closed colour set.">
      <Swatch token="--color-inert" />
    </Row>

    <Row
      title="token · --text-display (26px)"
      why="The type ladder's new top step — the destination-readout size Stat's display rung consumes."
    >
      <span className="font-cond text-display font-bold leading-none text-ink">
        {villageCrawler?.structurePoints ?? 25}
      </span>
      <code className="self-end font-mono text-note text-wk-muted">--text-display · 26px</code>
    </Row>

    {/* ------------------------ DANGER CONSOLIDATION ------------------------ */}
    <Row
      title="--color-danger retired → --color-status-bad"
      why="Destructive/error surfaces now sit on the sanctioned state token (left). Adversary is NOT part of that consolidation — it remains the ontology hue on entity headers (right), so a creature header and a delete button no longer share a colour by accident."
    >
      <span className="flex flex-col items-start gap-2">
        <Swatch token="--color-status-bad" />
        <Button variant="danger">Delete Mech</Button>
      </span>
      <span className="flex flex-col items-start gap-2">
        <Swatch token="--color-adversary" />
        {creature && <ReferenceEntityCard data={creature} size="medium" extent="head" />}
      </span>
    </Row>

    {/* --------------------------- SIZING LADDER ---------------------------- */}
    <Row
      title="sizing ladder · Button (full / compact / mini)"
      why="One canonical rung vocabulary replaces per-component xs/sm/md/lg. Each component below shows only the rungs it genuinely has."
    >
      <Button size="full" variant="primary">
        Save Pilot
      </Button>
      <Button size="compact">Add System</Button>
      <Button size="mini">⇄ Swap</Button>
    </Row>

    <Row
      title="sizing ladder · Stat, both anatomies"
      why="Value box (top) and horizontal cell (bottom) each carry all three rungs — but their DEFAULTS sit one rung apart: the box rests at compact (an annotation), the horizontal cell at full (a reading line)."
    >
      <span className="flex items-end gap-3">
        <Stat label="SP" value={chassis?.structurePoints ?? 8} size="full" />
        <Stat label="SP" value={chassis?.structurePoints ?? 8} size="compact" />
        <Stat label="SP" value={chassis?.structurePoints ?? 8} size="mini" />
      </span>
      <span className="flex flex-col items-start gap-2">
        <Stat
          orientation="horizontal"
          label="Tech LV"
          value={chassis?.techLevel ?? 1}
          size="full"
        />
        <Stat
          orientation="horizontal"
          label="Tech LV"
          value={chassis?.techLevel ?? 1}
          size="compact"
        />
        <Stat
          orientation="horizontal"
          label="Tech LV"
          value={chassis?.techLevel ?? 1}
          size="mini"
        />
      </span>
    </Row>

    <Row
      title="sizing ladder · VitalGauge (full / compact)"
      why="Two rungs — the gauge has no annotation size; compact was previously a boolean."
    >
      <span className="w-56">
        <VitalGauge
          label="SP"
          value={chassis?.structurePoints ?? 8}
          max={chassis?.structurePoints ?? 8}
          size="full"
          readOnly
        />
      </span>
      <span className="w-44">
        <VitalGauge
          label="SP"
          value={chassis?.structurePoints ?? 8}
          max={chassis?.structurePoints ?? 8}
          size="compact"
          readOnly
        />
      </span>
    </Row>

    <Row
      title="sizing ladder · Callout (full / compact)"
      why="Two rungs — the reading note and the dense listing note; compact was previously a boolean."
    >
      <span className="w-80">
        <Callout label="Downtime" tone="mech" size="full">
          <Text variant="body">
            Structure Points are restored during Downtime at the Union Crawler.
          </Text>
        </Callout>
      </span>
      <span className="w-72">
        <Callout label="Downtime" tone="mech" size="compact">
          <Text variant="body">
            Structure Points are restored during Downtime at the Union Crawler.
          </Text>
        </Callout>
      </span>
    </Row>

    <Row
      title="sizing ladder · RollTable (full / compact)"
      why="Two rungs — compact tightens rows and chips for rails/tooltips; previously a boolean. The row banding is the sanctioned band-cream."
    >
      {rollTable && (
        <>
          <span className="w-[480px] max-w-full">
            <RollTable table={rollTable} tableName={rollTableEntity?.name} showCommand />
          </span>
          <span className="w-[380px] max-w-full">
            <RollTable
              table={rollTable}
              tableName={rollTableEntity?.name}
              showCommand
              size="compact"
            />
          </span>
        </>
      )}
    </Row>

    {/* ------------------------- STAT'S DISPLAY RUNG ------------------------ */}
    <Row
      title="Stat display rung · crawler economy restored"
      why="The crawler-economy readouts ARE the panel — they read at the 26px display numeral (left cluster). Mid-refactor they briefly shrank to the 13px annotation size (right cluster, shown for contrast)."
    >
      <span className="flex items-end gap-2.5">
        <Stat size="full" label="Tech LVL" value={villageCrawler?.techLevel ?? 2} />
        <Stat size="full" label="Upkeep" value={villageCrawler?.upkeepCost ?? 5} />
        <Stat size="full" label="Upgrade" value={villageCrawler?.upgradeCost ?? 30} />
      </span>
      <span className="flex items-end gap-2.5 opacity-60">
        <Stat size="compact" label="Tech LVL" value={villageCrawler?.techLevel ?? 2} />
        <Stat size="compact" label="Upkeep" value={villageCrawler?.upkeepCost ?? 5} />
        <Stat size="compact" label="Upgrade" value={villageCrawler?.upgradeCost ?? 30} />
      </span>
    </Row>

    {/* --------------------------- ADOPTED ORPHANS -------------------------- */}
    <Row
      title="adopted orphans · SlotGrid / InlineRef / Skeleton / Callout / ConditionChip / EntityGrid / Inset"
      why="Seven primitives built to spec, storied, and never wired up — now adopted by production surfaces (sheets, wizard, dashboard). Callout appears at full size in the ladder row above."
    >
      <span className="flex flex-col items-start gap-1">
        <code className="font-mono text-note text-wk-muted">SlotGrid</code>
        <SlotGrid used={chassis?.moduleSlots ?? 2} cap={(chassis?.moduleSlots ?? 2) + 2} />
      </span>
      <span className="flex flex-col items-start gap-1">
        <code className="font-mono text-note text-wk-muted">InlineRef</code>
        <Text variant="body">
          Fitted with a <InlineRef title={system?.name ?? 'System'}>{system?.name}</InlineRef>.
        </Text>
      </span>
      <span className="flex w-40 flex-col items-start gap-1">
        <code className="font-mono text-note text-wk-muted">Skeleton</code>
        <Skeleton mode="card" />
      </span>
      <span className="flex flex-col items-start gap-1">
        <code className="font-mono text-note text-wk-muted">ConditionChip</code>
        <ConditionChip label="On Fire" onRemove={() => {}} />
      </span>
      <span className="flex flex-col items-start gap-1">
        <code className="font-mono text-note text-wk-muted">EntityGrid</code>
        <EntityGrid className="w-[440px] max-w-full">
          {chassis && <ReferenceEntityCard data={chassis} size="medium" extent="head" />}
          {system && <ReferenceEntityCard data={system} size="medium" extent="head" />}
        </EntityGrid>
      </span>
      <span className="flex w-72 flex-col items-start gap-1">
        <code className="font-mono text-note text-wk-muted">Inset</code>
        <Inset tone="crawler" tag="Crawler" label="Economy" className="w-full">
          <Stat size="full" label="Upkeep" value={villageCrawler?.upkeepCost ?? 5} />
        </Inset>
      </span>
    </Row>

    {/* ------------------------------- MERGES ------------------------------- */}
    <Row
      title="merge · CalloutMetaStamp → Badge shape=&quot;stamp&quot;"
      why="One stamp implementation; the seam variant rides the same atom."
    >
      <Badge shape="stamp">{chassis?.name ?? 'Mule'}</Badge>
      <Badge shape="stamp" size="mini" surface="inverse">
        TL {chassis?.techLevel ?? 1}
      </Badge>
    </Row>

    <Row
      title="merge · Panel.Empty → EmptyState"
      why="One empty-state implementation for panels, rosters and lists."
    >
      <span className="w-72">
        <EmptyState headline="No systems installed" body="Fit a system to see it here." />
      </span>
    </Row>

    <Row
      title="merge · SelectorDialog + DeleteConfirmDialog → ModalShell tone"
      why="Both dialogs were ModalShell wearing different headers; `tone` ('action' | 'danger') is now the whole API. Click to open."
    >
      <ModalToneDemo />
    </Row>

    <Row
      title="merge · SectionChead → Slab variant=&quot;solid&quot;"
      why="The solid section head is a Slab variant, not a sibling component."
    >
      <span className="w-80">
        <Slab label="Systems" count={chassis?.systemSlots ?? 16} variant="solid" />
      </span>
      <span className="w-80">
        <Slab label="Modules" count={chassis?.moduleSlots ?? 2} variant="dashed" />
      </span>
    </Row>

    <Row
      title="merge · ContextualEntityDisplay → EntityTooltip (entityId XOR entityName)"
      why="One tooltip component resolves by id or by name — the two former components' lookups, one API. Hover either trigger."
    >
      {system && (
        <EntityTooltip schemaName="systems" entityId={system.id}>
          <Badge shape="stamp" className="cursor-help">
            by entityId — {system.name}
          </Badge>
        </EntityTooltip>
      )}
      {naniteSifter && (
        <EntityTooltip schemaName="systems" entityName={naniteSifter.name}>
          <Badge shape="stamp" className="cursor-help">
            by entityName — {naniteSifter.name}
          </Badge>
        </EntityTooltip>
      )}
    </Row>

    {/* ----------------------------- FIXED BUGS ----------------------------- */}
    <Row
      title="fixed · card header width rule"
      why="One occupant-aware law: an empty right side lets the title own the row (Coolant Flush no longer wraps); a stat cluster still reserves (the historical overlap fix is pinned by test); flavour PROSE now yields, so Bionic Arms no longer stacks one letter per line."
    >
      {coolantFlush && (
        <span className="w-72">
          <ReferenceEntityCard data={coolantFlush} size="medium" extent="head" />
        </span>
      )}
      {bionicArms && (
        <span className="w-96 max-w-full">
          <ReferenceEntityCard data={bionicArms} />
        </span>
      )}
    </Row>

    <Row
      title="fixed · nested actions drop the (Parent) suffix"
      why="The DATA keeps the disambiguating suffix ('Refine (Nanite Sifter)'); display strips it ONLY inside the parent that names it — here the nested action header reads REFINE. Everywhere the parent isn't established by context, the full name still renders."
    >
      {naniteSifter && (
        <span className="w-96 max-w-full">
          <ReferenceEntityCard data={naniteSifter} />
        </span>
      )}
    </Row>

    {/* ---------------------------- ENTITYTOOLTIP --------------------------- */}
    <Row
      title="EntityTooltip · terminal and dense (ruleset §1)"
      why="The hover popup is now the DENSE catalog-extent card in the terminal context — a glance, not a second page. Hover the trigger."
    >
      {chassis && (
        <EntityTooltip schemaName="chassis" entityId={chassis.id}>
          <Badge shape="stamp" className="cursor-help">
            Hover — {chassis.name}
          </Badge>
        </EntityTooltip>
      )}
    </Row>
  </div>
)
