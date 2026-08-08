/**
 * Grouping and consequence copy for the live sheet's Change Class picker.
 *
 * The picker used to be one flat list of all eleven classes, which offered a
 * Hacker three hybrids they cannot reach and said nothing about what changing
 * would cost. This shapes the same list by the ring instead.
 *
 * ## Free Edit, so nothing is removed
 *
 * Every class stays selectable ([ADR-021](../../../../../docs/adrs/ADR-021-itun-surface-taxonomy.md):
 * the sheet does not gate). Unreachable destinations are demoted and labelled,
 * not withheld — they are not INERT, they simply cost one extra question, which
 * is why they are dimmed rather than filtered the way an option that would do
 * nothing should be.
 *
 * ## The origin usually needs no asking
 *
 * The pilot's CURRENT class is the origin. A Hacker who picks Cyborg came from
 * Hacker — that is what they were a moment ago — so the second fact is captured
 * by the act of changing rather than by a prompt. Only three cases need asking:
 * an off-ring hybrid, a pilot who is already a hybrid, and a pilot whose class
 * resolves to nothing.
 */

import type { SURefClass } from 'salvageunion-reference'
import type { AdvancementOption } from 'salvageunion-reference/rules'
import {
  advancementOptionsFor,
  liveAdvancementDataset,
  originsForHybrid,
  resolveAdvancementTrees,
} from 'salvageunion-reference/rules'

export type ClassPathGroupKind = 'reachable' | 'core' | 'off-ring'

export type ClassPathOption = {
  /** The class record to select. */
  cls: SURefClass
  /** Short caption: how this destination is reached, or why it is demoted. */
  note?: string
  /** True for the pilot's current class. */
  current: boolean
}

export type ClassPathGroup = {
  kind: ClassPathGroupKind
  label: string
  options: ClassPathOption[]
}

/** The Gain / Lose / Keep ledger for a pending selection. */
export type ClassPathConsequence = {
  /** e.g. 'Hacker → Cyborg', or just the class name when not advancing. */
  title: string
  gain: readonly string[]
  lose: readonly string[]
  keep: readonly string[]
  /** The origin that will be recorded, when one is implied. */
  impliedOrigin?: string
  /** True when the player must be asked which Core class they came from. */
  needsOrigin: boolean
  /** The Core classes to offer when `needsOrigin`. */
  originChoices: readonly string[]
}

const isHybrid = (cls: SURefClass): boolean => 'hybrid' in cls && cls.hybrid === true
const isCore = (cls: SURefClass): boolean =>
  'coreTrees' in cls && Array.isArray(cls.coreTrees) && cls.coreTrees.length > 0

/**
 * Shape the class list around where this pilot can actually go.
 *
 * `reachable` is populated only when the pilot's current class is a Core class
 * that can advance — a pilot who has already advanced has made this choice, and
 * a Salvager never had it.
 */
export function classPathGroups(
  allClasses: readonly SURefClass[],
  currentClassRef: string
): ClassPathGroup[] {
  const data = liveAdvancementDataset()
  const current = allClasses.find((c) => c.id === currentClassRef)
  const currentName = current?.name
  const options: AdvancementOption[] =
    currentName === undefined ? [] : advancementOptionsFor(data, currentName)

  const reachableNames = new Set(options.filter((o) => o.kind === 'hybrid').map((o) => o.name))
  const gateByName = new Map(options.map((o) => [o.name, o.gateTree]))

  const groups: ClassPathGroup[] = []

  if (reachableNames.size > 0) {
    groups.push({
      kind: 'reachable',
      label: `From ${currentName}`,
      options: allClasses
        .filter((c) => reachableNames.has(c.name))
        .map((cls) => ({
          cls,
          note: `via ${gateByName.get(cls.name) ?? ''}`,
          current: false,
        })),
    })
  }

  groups.push({
    kind: 'core',
    label: reachableNames.size > 0 ? 'Re-home to a Core Class' : 'Core Classes',
    options: allClasses.filter(isCore).map((cls) => ({ cls, current: cls.id === currentClassRef })),
  })

  const offRing = allClasses.filter((c) => isHybrid(c) && !reachableNames.has(c.name))
  if (offRing.length > 0) {
    groups.push({
      kind: 'off-ring',
      label: reachableNames.size > 0 ? "Not on this pilot's ring" : 'Advanced / Hybrid',
      options: offRing.map((cls) => ({
        cls,
        note: 'asks origin',
        current: cls.id === currentClassRef,
      })),
    })
  }

  return groups
}

/**
 * What changing to `pendingRef` would do, phrased for a player.
 *
 * `lose` deliberately names and counts what closes rather than gesturing at it:
 * the player is trading specific future picks, not a mood. `keep` always leads
 * with the retained abilities, because the likeliest misreading of this screen
 * is "do I lose the abilities I already have?" — and the answer is never.
 */
export function classPathConsequence(
  allClasses: readonly SURefClass[],
  currentClassRef: string,
  pendingRef: string
): ClassPathConsequence | undefined {
  const data = liveAdvancementDataset()
  const current = allClasses.find((c) => c.id === currentClassRef)
  const pending = allClasses.find((c) => c.id === pendingRef)
  if (pending === undefined) return undefined

  if (!isHybrid(pending)) {
    return {
      title: pending.name,
      gain: resolveAdvancementTrees(data, undefined, pending.name).open,
      lose: [],
      keep: ['Every ability already learned'],
      needsOrigin: false,
      originChoices: [],
    }
  }

  const candidates = originsForHybrid(data, pending.name)
  const impliedOrigin =
    current !== undefined && isCore(current) && candidates.includes(current.name)
      ? current.name
      : undefined

  const trees = resolveAdvancementTrees(data, impliedOrigin, pending.name)
  const gate = trees.gate
  const gained = trees.open.filter((t) => t !== gate && t !== pending.name)

  // Every hybrid the pilot is NOT choosing, plus their Advanced tree, closes.
  const foreclosed =
    impliedOrigin === undefined
      ? []
      : advancementOptionsFor(data, impliedOrigin)
          .filter((o) => o.name !== pending.name)
          .map((o) => o.name)

  const lose: string[] = [...foreclosed.map((n) => `${n} — forever`)]
  if (trees.sealed.length > 0) {
    lose.push(`${trees.sealed.join(' and ')} seal — no new picks`)
  }

  return {
    title: impliedOrigin === undefined ? pending.name : `${impliedOrigin} → ${pending.name}`,
    gain: [pending.name, ...gained],
    lose,
    keep: [
      'Every ability already learned, permanently',
      ...(gate === undefined ? [] : [`${gate} stays open`]),
    ],
    impliedOrigin,
    needsOrigin: impliedOrigin === undefined,
    originChoices: candidates,
  }
}

/**
 * The patch a confirmed class change should write.
 *
 * Both fields go in ONE object on purpose: `patchPilot` routes any patch
 * containing `classRef` through the soft-warning confirm, so a second write for
 * the origin would either slip past that gate or leave a row whose class moved
 * and whose origin did not — the unknown-origin state this field exists to
 * prevent.
 *
 * `originClassRef` is an OVERRIDE, so it is written only when the origin cannot
 * be derived and the player answered. Moving to a Core class clears it: a pilot
 * who is not a hybrid has no origin to record.
 */
export function classChangePatch(
  allClasses: readonly SURefClass[],
  pendingRef: string,
  answeredOrigin: string | undefined
): { classRef: string; originClassRef?: string | undefined } {
  const pending = allClasses.find((c) => c.id === pendingRef)
  if (pending === undefined || !isHybrid(pending)) {
    return { classRef: pendingRef, originClassRef: undefined }
  }
  return { classRef: pendingRef, originClassRef: answeredOrigin }
}
