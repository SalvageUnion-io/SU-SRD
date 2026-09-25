/**
 * PilotBand — the Active Item while On Foot: the pilot's HP/AP vitals, Take
 * Damage with the player-confirmed Critical Injury roll (ADR-007), and the
 * control to board the mech.
 */

import { CountStepper } from 'component-lib'
import { useEffect, useState } from 'react'
import { resolvePool, resolvePoolStart } from 'salvageunion-reference/rules'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { pilotMaxAP, pilotMaxHP } from '../../lib/rules/derivedStats'
import { defaultRoll } from '../../lib/rules/heatCheck'
import type { CriticalInjuryEffect } from '../../lib/rules/takeDamage'
import { runWrite } from '../../lib/runWrite'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Pilot } from '../../lib/schemas/pilot'
import { usePlayStateStore } from '../../stores/playStateStore'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import type { PlayStore } from './ActiveItemBand'
import type { ActiveItemBandModel } from './ActiveItemBandFrame'
import { ActiveItemBandFrame } from './ActiveItemBandFrame'
import { critInjuryPatch, describeCritInjury, pilotDamagePatch } from './dashboardRules'

type PilotPrompt =
  | { kind: 'log'; log: string }
  | { kind: 'dmg' }
  | { kind: 'crit'; effect: CriticalInjuryEffect | null; log: string }
  | null

export function PilotBand({
  pilot,
  crawler,
  store,
  onBoard,
}: {
  pilot: Pilot
  /** The pilot's crawler — its tier drives Stat Training (max HP/AP). */
  crawler: Crawler | null
  store: PlayStore
  onBoard: () => void
}) {
  const crawlerTechLevel = resolveEffectiveCrawlerLevel(pilot, crawler)
  const maxHP = Math.max(0, pilotMaxHP({ ...pilot, crawlerTechLevel }))
  const maxAP = Math.max(0, pilotMaxAP({ ...pilot, crawlerTechLevel }))
  const hp = resolvePool(pilot.currentHP, maxHP)
  const ap = resolvePool(pilot.currentAP, maxAP)

  const [prompt, setPrompt] = useState<PilotPrompt>(null)
  const [dmg, setDmg] = useState(1)

  // On-foot: the deck's Apply routes a destructive Cascade Failure here — open
  // the Take-HP-Damage overlay pre-armed for the player to confirm (ADR-007).
  const damagePromptArmed = usePlayStateStore((st) => st.damagePromptArmed)
  const consumeDamagePrompt = usePlayStateStore((st) => st.consumeDamagePrompt)
  useEffect(() => {
    if (damagePromptArmed) {
      setPrompt({ kind: 'dmg' })
      consumeDamagePrompt()
    }
  }, [damagePromptArmed, consumeDamagePrompt])

  const fresh = () => store.get('pilot', pilot.id) ?? pilot

  function applyDamage() {
    const p = fresh()
    const { patch, effect } = pilotDamagePatch({
      currentHP: resolvePoolStart(p.currentHP, Math.max(0, pilotMaxHP({ ...p, crawlerTechLevel }))),
      amount: dmg,
      vulnerable: false,
    })
    runWrite(
      () => store.update('pilot', pilot.id, patch, DASHBOARD_TXN),
      () =>
        setPrompt(
          effect.criticalDue
            ? { kind: 'crit', effect: null, log: `−${effect.effectiveDamage} HP → 0.` }
            : { kind: 'log', log: `−${effect.effectiveDamage} HP → ${effect.nextHP}.` }
        )
    )
  }

  function rollInjury() {
    const { patch, effect } = critInjuryPatch(defaultRoll)
    runWrite(
      () => store.update('pilot', pilot.id, patch, DASHBOARD_TXN),
      () => setPrompt({ kind: 'crit', effect, log: describeCritInjury(effect) })
    )
  }

  const overlay = ((): ActiveItemBandModel['overlay'] => {
    if (!prompt) return null
    const onClose = () => setPrompt(null)
    if (prompt.kind === 'log') {
      return { title: 'Vitals', onClose, body: <p className="pc-resolve-log">{prompt.log}</p> }
    }
    if (prompt.kind === 'dmg') {
      return {
        title: 'Take Damage',
        onClose,
        // Keep the gauge being edited on screen (see BandOverlay.gauges).
        gauges: [{ label: 'HP', value: hp, max: maxHP, tone: 'pilot' }],
        body: (
          <CountStepper
            count={dmg}
            onChange={setDmg}
            subject="damage point"
            min={1}
            surface="instrument"
          />
        ),
        actions: [{ label: `Apply −${dmg} HP`, onClick: applyDamage, variant: 'go' }],
      }
    }
    // crit
    return {
      title: 'Critical Injury',
      onClose,
      body: <p className="pc-resolve-log">{prompt.log}</p>,
      actions:
        prompt.effect === null
          ? [{ label: 'Roll Critical Injury', onClick: rollInjury, variant: 'danger' }]
          : undefined,
    }
  })()

  const view: ActiveItemBandModel = {
    fam: 'pilot',
    stampLabel: 'On Foot',
    bays: [
      {
        label: 'Vitals',
        gauges: [
          { label: 'HP', value: hp, max: maxHP, tone: 'pilot' },
          { label: 'AP', value: ap, max: maxAP, tone: 'pilot' },
        ],
        buttons: [
          {
            label: 'Take Dmg',
            onClick: () => {
              setDmg(1)
              setPrompt({ kind: 'dmg' })
            },
            title: 'Take HP damage',
          },
          {
            label: 'Crit Injury',
            onClick: () =>
              setPrompt({ kind: 'crit', effect: null, log: 'Roll a Critical Injury?' }),
            variant: 'danger',
            title: 'Roll on the Critical Injury table',
          },
        ],
      },
      {
        label: 'Mount',
        buttons: [
          {
            label: '▶ Board Mech',
            onClick: onBoard,
            variant: 'go',
            wide: true,
            title: 'Board the mech',
          },
        ],
      },
    ],
    overlay,
  }
  return <ActiveItemBandFrame view={view} />
}
