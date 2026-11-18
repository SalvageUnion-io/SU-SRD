// MOCK (Working Manual, wave 2) · Step 2 · Systems and modules, as pickers in
// the Ledger form (`PickList`, its count pick). The Tech 1 systems and the
// Tech 1 modules are two framed lists down one column, a 28px line an item:
// Slots, SV, Action, RNG, DMG and its traits in fixed columns, and its count's
// stepper at the line's end. A list's head strip carries its slot budget
// (`SLOTS | 7/16`), and the step opens on the three budgets as pip trackers
// (`WizTracker`), Scrap among them. The line in focus opens as its contentful
// card beside the lists (step 1's chassis card, the same column), where its
// options are chosen; on a phone the card opens under its line. The rules are
// unchanged: only Tech 1 renders, a copy costs its SV from the 20-Scrap pool
// and its slots from its list's budget, and a `+` that would overspend either
// is off, its line dimmed with the reason on a pointer.
import { useMemo, useState } from 'react'
import type { ChoiceSelections, RefModule, RefSystem } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import {
  isLegalCreationModule,
  isLegalCreationSystem,
  MECH_CREATION_SCRAP_CAP,
} from 'salvageunion-reference/rules'
import { Badge, ReferenceEntityCard, Stat } from '../../components/index'
import { maxAddableCopies } from '../../lib/rules/creation'
import { mechCopy } from '../../messages/build-mech'
import { PickList } from '../wizard/PickList'
import { choicesOf, chosenChips, loadoutColumns } from '../wizard/pickColumns'
import { RecapMinis } from '../wizard/ReviewRecap'
import { WizMeter } from '../wizard/WizShell'

type Kind = 'systems' | 'modules'
type Item = RefSystem | RefModule

type MechLoadoutStepProps = {
  /** Installed slug refs, one entry a copy (duplicates allowed). */
  systems: string[]
  modules: string[]
  onCountChange: (kind: Kind, itemName: string, next: number) => void
  /** Tech 1 Scrap left in the shared 20-Scrap pool. */
  scrapRemaining: number
  slots: Record<Kind, { used: number; max: number }>
}

const COLUMNS = loadoutColumns<Item>()

const byName = (a: Item, b: Item) => a.name.localeCompare(b.name)

export function MechLoadoutStep({
  systems,
  modules,
  onCountChange,
  scrapRemaining,
  slots,
}: MechLoadoutStepProps) {
  const pools = useMemo(
    () => ({
      systems: SalvageUnionReference.Systems.all()
        .filter((s) => isLegalCreationSystem(s.techLevel))
        .sort(byName) as Item[],
      modules: SalvageUnionReference.Modules.all()
        .filter((m) => isLegalCreationModule(m.techLevel))
        .sort(byName) as Item[],
    }),
    []
  )
  const installed = { systems, modules }
  // The line the detail shows: the first system until the player picks one.
  const [focus, setFocus] = useState<{ kind: Kind; slug: string } | undefined>(undefined)
  const shown = focus ?? {
    kind: 'systems' as const,
    slug: pools.systems[0] ? getEntitySlug(pools.systems[0]) : '',
  }
  const focused = pools[shown.kind].find((item) => getEntitySlug(item) === shown.slug)
  // MOCK: a component's chosen options, kept on the step. The real build
  // carries them in the wizard's form and writes them with the mech.
  const [choices, setChoices] = useState<Record<string, ChoiceSelections>>({})

  const picked = (kind: Kind) =>
    installed[kind].flatMap((ref) => {
      const found = pools[kind].find((item) => getEntitySlug(item) === ref)
      return found ? [found] : []
    })
  const copies = (kind: Kind, item: Item) =>
    installed[kind].filter((ref) => ref === getEntitySlug(item)).length
  const room = (kind: Kind, item: Item) =>
    maxAddableCopies(item, {
      scrapRemaining,
      slotsRemaining: Math.max(0, slots[kind].max - slots[kind].used),
    })
  const blocked = (kind: Kind, item: Item) => {
    if (room(kind, item) > 0) return undefined
    const left = Math.max(0, slots[kind].max - slots[kind].used)
    return item.slotsRequired > left
      ? `Needs ${item.slotsRequired} slot${item.slotsRequired === 1 ? '' : 's'} · ${left} left`
      : `Needs ${item.salvageValue} Scrap · ${scrapRemaining} left`
  }

  const card = (kind: Kind, item: Item, inline = false) => {
    const slug = getEntitySlug(item)
    const count = copies(kind, item)
    const reason = blocked(kind, item)
    const asks = choicesOf(item).length > 0
    return (
      <div className="su-wiz-own-rules">
        <ReferenceEntityCard
          data={item}
          size="compact"
          selected={count >= 1}
          hide={{ actions: true }}
          suggested={'recommended' in item && item.recommended === true}
          controls={[
            {
              key: 'qty',
              stepper: {
                label: mechCopy('qty'),
                subject: `${item.name} count`,
                value: count,
                ceiling: count + room(kind, item),
                onChange: (next) => onCountChange(kind, item.name, next),
              },
            },
          ]}
          {...(asks
            ? {
                selections: choices[slug] ?? {},
                onSelectionChange: (next: ChoiceSelections) =>
                  setChoices((was) => ({ ...was, [slug]: next })),
              }
            : {})}
          // Under its line the SV column has said the cost; the foot is the source.
          footMeta={[
            ...(inline ? [] : [{ label: mechCopy('costs'), value: `${item.salvageValue} Scrap` }]),
            ...(reason && count === 0 ? [{ label: reason, value: '' }] : []),
          ]}
        />
      </div>
    )
  }

  const list = (kind: Kind, title: string, cite: string) => (
    <div>
      <PickList
        title={title}
        note={<Stat label="Slots" value={slots[kind].used} max={slots[kind].max} size="mini" />}
        rows={pools[kind]}
        rowKey={getEntitySlug}
        rowName={(item) => item.name}
        columns={COLUMNS}
        selected={shown.kind === kind ? shown.slug : undefined}
        onSelect={(slug) => setFocus({ kind, slug })}
        count={{
          label: mechCopy('qty'),
          value: (item) => copies(kind, item),
          max: (item) => copies(kind, item) + room(kind, item),
          onChange: (item, next) => {
            setFocus({ kind, slug: getEntitySlug(item) })
            onCountChange(kind, item.name, next)
          },
        }}
        stamp={(item) =>
          'recommended' in item && item.recommended === true ? (
            <Badge shape="stamp" size="mini" surface="inverse">
              Suggested
            </Badge>
          ) : undefined
        }
        under={(item) => chosenChips(item, choices[getEntitySlug(item)])}
        disabled={(item) => blocked(kind, item)}
        detail={(item) => card(kind, item, true)}
        foot={{ cite, meta: { label: 'Costs', value: 'its SV in Tech 1 Scrap a copy' } }}
      />
    </div>
  )

  return (
    <div className="su-wiz-stack su-wiz-stack--12">
      {/* The three budgets, each a pip tracker: what is left to spend, what is filled. */}
      <div className="su-wiz-budget">
        <WizMeter label={mechCopy('scrap')} value={scrapRemaining} max={MECH_CREATION_SCRAP_CAP} />
        <WizMeter
          label={mechCopy('systemSlots')}
          value={slots.systems.used}
          max={slots.systems.max}
        />
        <WizMeter
          label={mechCopy('moduleSlots')}
          value={slots.modules.used}
          max={slots.modules.max}
        />
      </div>
      <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
        <div className="su-wiz-compare-main">
          {list(
            'systems',
            mechCopy('tech1S', { noun: 'System' }),
            'Workshop Manual · p.95 · Systems pp.162–187'
          )}
          {list(
            'modules',
            mechCopy('tech1S', { noun: 'Module' }),
            'Workshop Manual · p.95 · Modules pp.188–207'
          )}
        </div>
        <div className="su-wiz-compare-detail su-wiz-compare-detail--sticky su-wiz-compare-detail--scroll su-wiz-compare-detail--desk">
          {focused && card(shown.kind, focused)}
          {/* What is installed so far, under the card: the column is never bare. */}
          <div>
            <RecapMinis label="Installed systems" entities={picked('systems')} empty="None yet" />
            <RecapMinis label="Installed modules" entities={picked('modules')} empty="None yet" />
          </div>
        </div>
      </div>
    </div>
  )
}
