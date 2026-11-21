// Step 2 · Systems and Modules (Workshop Manual p.95), as pickers in the
// Ledger form (`PickList`, its count pick). The Tech 1 Systems and the Tech 1
// Modules are a framed list each, a line an item: Slots, SV, Action, RNG and
// DMG in fixed columns, and its count's stepper at the line's end.
// The step opens on the three budgets as meters (`WizMeter`), Scrap among
// them; a list's head says no budget of its own, so its count keeps its frame. Beside
// each list stand the line it has in focus, as its contentful card (where an
// option it asks is chosen), and what is installed from it so far; on a phone
// the card opens under its line. Only Tech 1 renders, a copy costs its SV from
// the 20-Scrap pool and its slots from its list's budget, and a `+` that would
// overspend either is off, its line dimmed with the reason on a pointer.
import { useMemo, useState } from 'react'
import type { BookCite, ChoiceSelections, RefModule, RefSystem } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import {
  isLegalCreationModule,
  isLegalCreationSystem,
  MECH_CREATION_SCRAP_CAP,
} from 'salvageunion-reference/rules'
import { Badge, ReferenceEntityCard } from '../../components/index'
import { maxAddableCopies } from '../../lib/rules/creation'
import { LOCOMOTION } from '../../lib/rules/locomotion'
import { mechCopy } from '../../messages/build-mech'
import { PickList } from '../wizard/PickList'
import { choicesOf, chosenChips, loadoutColumns } from '../wizard/pickColumns'
import { RecapMinis } from '../wizard/ReviewRecap'
import { WizMeter } from '../wizard/WizBudget'

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
  /** The options chosen on an item that asks a choice, by its slug (the form's `itemChoices`). */
  choices: Record<string, ChoiceSelections> | undefined
  onChoices: (slug: string, next: ChoiceSelections) => void
  /** Where the book prints each list's rule, on its foot. */
  cites: Record<Kind, BookCite>
  /** The chassis moves by its own Chassis Ability: a Locomotion System is no suggestion for it. */
  ownLocomotion?: boolean
}

const KINDS: readonly Kind[] = ['systems', 'modules']

const TITLES: Record<Kind, string> = {
  systems: mechCopy('tech1S', { noun: 'System' }),
  modules: mechCopy('tech1S', { noun: 'Module' }),
}

const byName = (a: Item, b: Item) => a.name.localeCompare(b.name)

export function MechLoadoutStep({
  systems,
  modules,
  onCountChange,
  scrapRemaining,
  slots,
  choices,
  onChoices,
  cites,
  ownLocomotion = false,
}: MechLoadoutStepProps) {
  const isSuggested = (item: Item) =>
    'recommended' in item &&
    item.recommended === true &&
    !(ownLocomotion && LOCOMOTION.test(item.name))
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
  // The line each list's card shows: its first until the player picks one.
  const [focus, setFocus] = useState<Partial<Record<Kind, string>>>({})
  // No Traits column: the line's card beside it says them, and the line keeps
  // its count's stepper inside its frame at every width.
  const columns = useMemo(
    () =>
      loadoutColumns<Item>((item) => choices?.[getEntitySlug(item)]).filter(
        (column) => column.key !== 'traits'
      ),
    [choices]
  )

  const picked = (kind: Kind) =>
    installed[kind].flatMap((ref) => {
      const found = pools[kind].find((item) => getEntitySlug(item) === ref)
      return found ? [found] : []
    })
  const copies = (kind: Kind, item: Item) =>
    installed[kind].filter((ref) => ref === getEntitySlug(item)).length
  const slotsLeft = (kind: Kind) => Math.max(0, slots[kind].max - slots[kind].used)
  const room = (kind: Kind, item: Item) =>
    maxAddableCopies(item, { scrapRemaining, slotsRemaining: slotsLeft(kind) })
  const blocked = (kind: Kind, item: Item) => {
    if (room(kind, item) > 0) return undefined
    return item.slotsRequired > slotsLeft(kind)
      ? mechCopy('needsSlots', { count: item.slotsRequired, left: slotsLeft(kind) })
      : mechCopy('needsScrap', { count: item.salvageValue, left: scrapRemaining })
  }

  const card = (kind: Kind, item: Item, inline = false) => {
    const slug = getEntitySlug(item)
    const count = copies(kind, item)
    const reason = blocked(kind, item)
    const asks = choicesOf(item).length > 0
    return (
      <ReferenceEntityCard
        data={item}
        size="compact"
        selected={count >= 1}
        // A pick's card says its own rules: no lead line, no flavour.
        hide={{ lead: true, flavor: true, ...(asks ? {} : { actions: true, choices: true }) }}
        suggested={isSuggested(item)}
        {...(asks
          ? {
              selections: choices?.[slug] ?? {},
              onSelectionChange: (next: ChoiceSelections) => onChoices(slug, next),
            }
          : {})}
        // Under its line the SV column has said the cost; the foot is the source.
        footMeta={[
          ...(inline
            ? []
            : [
                {
                  label: mechCopy('costs'),
                  value: mechCopy('scrapCost', { count: item.salvageValue }),
                },
              ]),
          ...(reason && count === 0 ? [{ label: reason, value: '' }] : []),
        ]}
      />
    )
  }

  const band = (kind: Kind) => {
    const shown = focus[kind] ?? (pools[kind][0] ? getEntitySlug(pools[kind][0]) : undefined)
    const focused = pools[kind].find((item) => getEntitySlug(item) === shown)
    return (
      <div key={kind} className="su-wiz-compare-layout su-wiz-compare-layout--wide">
        <div className="su-wiz-compare-main">
          <PickList
            title={TITLES[kind]}
            rows={pools[kind]}
            rowKey={getEntitySlug}
            rowName={(item) => item.name}
            columns={columns}
            selected={shown}
            onSelect={(slug) => setFocus((was) => ({ ...was, [kind]: slug }))}
            count={{
              label: mechCopy('qty'),
              value: (item) => copies(kind, item),
              max: (item) => copies(kind, item) + room(kind, item),
              onChange: (item, next) => {
                setFocus((was) => ({ ...was, [kind]: getEntitySlug(item) }))
                onCountChange(kind, item.name, next)
              },
            }}
            stamp={(item) =>
              isSuggested(item) ? (
                <Badge shape="stamp" size="mini" surface="inverse">
                  {mechCopy('suggested')}
                </Badge>
              ) : undefined
            }
            under={(item) => chosenChips(item, choices?.[getEntitySlug(item)])}
            disabled={(item) => blocked(kind, item)}
            detail={(item) => card(kind, item, true)}
            foot={{
              cite: cites[kind],
              meta: { label: mechCopy('costs'), value: mechCopy('itsSvInTech1') },
            }}
          />
        </div>
        <div className="su-wiz-compare-detail su-wiz-compare-detail--sticky su-wiz-compare-detail--scroll su-wiz-compare-detail--desk">
          {focused && card(kind, focused)}
          <RecapMinis
            label={mechCopy(kind === 'systems' ? 'installedSystems' : 'installedModules')}
            entities={picked(kind)}
            empty={mechCopy('noneYet')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="su-wiz-step">
      {/* The three budgets, each a meter counting up: Scrap spent, slots filled. */}
      <div className="su-wiz-budget">
        <WizMeter
          label={mechCopy('scrapSpent')}
          value={MECH_CREATION_SCRAP_CAP - scrapRemaining}
          max={MECH_CREATION_SCRAP_CAP}
        />
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
      {KINDS.map(band)}
    </div>
  )
}
