/**
 * GameLedger — **Factions** and **Jobs** on a Game's own page
 * (docs/architecture/play.md §16): who the crew deals with and the work they
 * have taken, from the Game's ledger (`rooms/game/ledger.ts`).
 *
 * Every member reads both lists, header-only Minis one a line; only the
 * Mediator writes them. A faction's chips are its standing and, once signed,
 * its Deal, and its ⋯ sets both or removes it. A deal pays 1 Scrap of the
 * crawler's Tech Level every Downtime, collected beside Upkeep in the
 * Mediator's Downtime (`PlayMediatorDowntime`). A job's chips are who it is
 * for and its pay; while open, **Finish** pays it into the Game's crawler
 * behind a confirm, once (the server marks it done in the same write), and
 * its ⋯ drops, reopens or removes it. Each list's `AdderBox` adds a row.
 */

import { factionOf } from 'game-domain/games/ledger'
import type { Faction, FactionStanding, Job } from 'game-domain/schemas/ledger'
import { LEDGER_MAX_NAME, LEDGER_MAX_PAY } from 'game-domain/schemas/ledger'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import type { EntityFormModel } from '../../components/index'
import {
  AdderBox,
  AdderField,
  Button,
  ConfirmDialog,
  Entity,
  FieldError,
  HeaderMenu,
  Input,
  Select,
  SlabSection,
  Stat,
  Text,
  tokens,
} from '../../components/index'
import { failureMessage, useServerAction } from '../../lib/connection/useServerAction'
import { syntheticModel } from '../../lib/units/syntheticModel'
import { playGamesCopy } from '../../messages/play-games'
import { useSync } from '../../replica/syncContext'
import { useTableAct, useTableRead } from '../../replica/useTable'
import { HUB_BODY } from './hubStyles.model'

const { space } = tokens

/** A list's Minis, one a line. */
const LINES = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const NAME_INPUT = { flex: 1, minWidth: '10rem' } satisfies CSSProperties
const NUMBER_INPUT = { width: '56px' } satisfies CSSProperties

const STANDING_LABEL = {
  hostile: playGamesCopy('hostile'),
  neutral: playGamesCopy('neutral'),
  friendly: playGamesCopy('friendly'),
} satisfies Record<FactionStanding, string>

const STANDING_ACTION = {
  hostile: playGamesCopy('makeHostile'),
  neutral: playGamesCopy('makeNeutral'),
  friendly: playGamesCopy('makeFriendly'),
} satisfies Record<FactionStanding, string>

const STATE_LABEL = {
  open: playGamesCopy('open'),
  done: playGamesCopy('done'),
  dropped: playGamesCopy('dropped'),
} satisfies Record<Job['state'], string>

function factionModel(faction: Faction): EntityFormModel {
  return syntheticModel({
    schemaName: 'npcs',
    id: `synthetic/faction/${faction.id}`,
    slug: faction.id,
    name: faction.name,
    kind: { label: playGamesCopy('faction'), domain: 'actor' },
    tone: 'ink',
  })
}

function jobModel(job: Job): EntityFormModel {
  return syntheticModel({
    schemaName: 'actions',
    id: `synthetic/job/${job.id}`,
    slug: job.id,
    name: job.name,
    kind: { label: playGamesCopy('job'), domain: 'action', nature: 'do' },
    tone: 'ink',
  })
}

/** A typed count, held to whole numbers in `min`..`max`. */
function clamp(raw: string, min: number, max: number): number {
  const n = Math.trunc(Number(raw))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}

/** Open jobs first, then the closed ones, each kept in the order added. */
function byState(jobs: readonly Job[]): Job[] {
  return [...jobs.filter((j) => j.state === 'open'), ...jobs.filter((j) => j.state !== 'open')]
}

export function GameLedger({ gameId, mediator }: { gameId: string; mediator: boolean }) {
  const ledger = useTableRead('ledger.get', { gameId })
  const { canWrite } = useSync()
  const failure = playGamesCopy('theLedgerCouldNotBe')
  const setFaction = useServerAction(useTableAct('ledger.setFaction', gameId), { failure })
  const removeFaction = useServerAction(useTableAct('ledger.removeFaction', gameId), { failure })
  const setJob = useServerAction(useTableAct('ledger.setJob', gameId), { failure })
  const setJobState = useServerAction(useTableAct('ledger.setJobState', gameId), { failure })
  const removeJob = useServerAction(useTableAct('ledger.removeJob', gameId), { failure })
  const completeJob = useTableAct('ledger.completeJob', gameId)

  const [removingFaction, setRemovingFaction] = useState<Faction | null>(null)
  const [removingJob, setRemovingJob] = useState<Job | null>(null)
  const [finishing, setFinishing] = useState<Job | null>(null)
  const [note, setNote] = useState<string | null>(null)

  if (ledger === undefined || ledger === null) return null
  const { factions, jobs } = ledger
  const off = !canWrite
  const error =
    setFaction.error ??
    removeFaction.error ??
    setJob.error ??
    setJobState.error ??
    removeJob.error ??
    null

  function factionMenu(faction: Faction) {
    const standings = (['hostile', 'neutral', 'friendly'] as const).filter(
      (s) => s !== faction.standing
    )
    return (
      <HeaderMenu
        variant="overflow"
        trigger={null}
        disabled={off}
        label={playGamesCopy('moreForFaction', { name: faction.name })}
        sections={[
          [
            {
              id: 'deal',
              label: faction.deal ? playGamesCopy('endTheDeal') : playGamesCopy('signADeal'),
              onSelect: () => void setFaction.run({ faction: { ...faction, deal: !faction.deal } }),
            },
            ...standings.map((standing) => ({
              id: standing,
              label: STANDING_ACTION[standing],
              onSelect: () => void setFaction.run({ faction: { ...faction, standing } }),
            })),
          ],
          [
            {
              id: 'remove',
              label: playGamesCopy('remove'),
              tone: 'danger' as const,
              onSelect: () => setRemovingFaction(faction),
            },
          ],
        ]}
      />
    )
  }

  function jobControls(job: Job) {
    return (
      <>
        {job.state === 'open' && (
          <Button size="mini" disabled={off} onClick={() => setFinishing(job)}>
            {playGamesCopy('finish')}
          </Button>
        )}
        <HeaderMenu
          variant="overflow"
          trigger={null}
          disabled={off}
          label={playGamesCopy('moreForJob', { name: job.name })}
          sections={[
            job.state === 'done'
              ? []
              : [
                  job.state === 'open'
                    ? {
                        id: 'drop',
                        label: playGamesCopy('drop'),
                        onSelect: () => void setJobState.run({ id: job.id, state: 'dropped' }),
                      }
                    : {
                        id: 'reopen',
                        label: playGamesCopy('reopen'),
                        onSelect: () => void setJobState.run({ id: job.id, state: 'open' }),
                      },
                ],
            [
              {
                id: 'remove',
                label: playGamesCopy('remove'),
                tone: 'danger' as const,
                onSelect: () => setRemovingJob(job),
              },
            ],
          ]}
        />
      </>
    )
  }

  return (
    <>
      <SlabSection
        as="h2"
        bodyStyle={HUB_BODY}
        id="factions-heading"
        title={playGamesCopy('factions')}
      >
        {factions.length === 0 ? (
          <Text variant="note">{playGamesCopy('noFactionsYet')}</Text>
        ) : (
          <ul aria-label={playGamesCopy('factions')} style={LINES}>
            {factions.map((faction) => (
              <li key={faction.id}>
                <Entity
                  size="mini"
                  context="roster"
                  model={factionModel(faction)}
                  state={
                    <>
                      <Stat size="mini" label={STANDING_LABEL[faction.standing]} />
                      {faction.deal && <Stat size="mini" label={playGamesCopy('deal')} />}
                    </>
                  }
                  {...(mediator ? { controls: factionMenu(faction) } : {})}
                />
              </li>
            ))}
          </ul>
        )}
        <Text variant="note">{playGamesCopy('factionsTheCrewDealsWith')}</Text>
        {mediator && (
          <FactionAdder
            disabled={off}
            onAdd={(name) =>
              setFaction.run({
                faction: { id: crypto.randomUUID(), name, standing: 'neutral', deal: false },
              })
            }
          />
        )}
      </SlabSection>

      <SlabSection as="h2" bodyStyle={HUB_BODY} id="jobs-heading" title={playGamesCopy('jobs')}>
        {jobs.length === 0 ? (
          <Text variant="note">{playGamesCopy('noJobsYet')}</Text>
        ) : (
          <ul aria-label={playGamesCopy('jobs')} style={LINES}>
            {byState(jobs).map((job) => (
              <li key={job.id}>
                <Entity
                  size="mini"
                  context="roster"
                  model={jobModel(job)}
                  state={
                    <>
                      <Stat
                        size="mini"
                        label={factionOf(ledger, job)?.name ?? playGamesCopy('nobody')}
                      />
                      <Stat
                        size="mini"
                        label={playGamesCopy('pay')}
                        value={playGamesCopy('payScrap', { pay: job.pay, tl: job.payTl })}
                      />
                      {job.state !== 'open' && <Stat size="mini" label={STATE_LABEL[job.state]} />}
                    </>
                  }
                  {...(mediator ? { controls: jobControls(job) } : {})}
                />
              </li>
            ))}
          </ul>
        )}
        {note !== null && (
          <Text variant="note" aria-live="polite">
            {note}
          </Text>
        )}
        {mediator && (
          <JobAdder
            disabled={off}
            factions={factions}
            onAdd={(terms) => setJob.run({ job: { id: crypto.randomUUID(), ...terms } })}
          />
        )}
        {error !== null && <FieldError>{error}</FieldError>}
      </SlabSection>

      <ConfirmDialog
        open={removingFaction !== null}
        onOpenChange={(open) => !open && setRemovingFaction(null)}
        tone="danger"
        title={playGamesCopy('removeFaction', { name: removingFaction?.name })}
        body={<span>{playGamesCopy('itsJobsStay')}</span>}
        confirmLabel={playGamesCopy('remove')}
        onConfirm={async () => {
          if (removingFaction === null) return
          await removeFaction.run({ id: removingFaction.id })
        }}
      />
      <ConfirmDialog
        open={removingJob !== null}
        onOpenChange={(open) => !open && setRemovingJob(null)}
        tone="danger"
        title={playGamesCopy('removeJob', { name: removingJob?.name })}
        body={
          removingJob?.state === 'done' ? <span>{playGamesCopy('aDoneJobStaysPaid')}</span> : null
        }
        confirmLabel={playGamesCopy('remove')}
        onConfirm={async () => {
          if (removingJob === null) return
          await removeJob.run({ id: removingJob.id })
        }}
      />
      <ConfirmDialog
        open={finishing !== null}
        onOpenChange={(open) => !open && setFinishing(null)}
        title={playGamesCopy('finishJob', { name: finishing?.name })}
        body={
          <span>
            {finishing !== null && finishing.pay > 0
              ? playGamesCopy('itPaysIntoTheCrawler', { pay: finishing.pay, tl: finishing.payTl })
              : playGamesCopy('itPaysNothing')}
          </span>
        }
        confirmLabel={playGamesCopy('finish')}
        describeError={(err) => failureMessage(err, playGamesCopy('thatJobCouldNotBe'))}
        onConfirm={async () => {
          if (finishing === null) return
          const paid = await completeJob({ id: finishing.id })
          setNote(
            paid === null
              ? playGamesCopy('alreadyDone')
              : playGamesCopy('paidInto', {
                  scrap: paid.scrap,
                  tl: paid.tl,
                  crawler: paid.crawlerName ?? playGamesCopy('theCrawler'),
                })
          )
        }}
      />
    </>
  )
}

/** The Factions list's intake: a name, then Add. */
function FactionAdder({
  disabled,
  onAdd,
}: {
  disabled: boolean
  onAdd: (name: string) => Promise<unknown>
}) {
  const [name, setName] = useState('')
  const ready = name.trim().length > 0 && !disabled

  function commit() {
    if (!ready) return
    void onAdd(name.trim())
    setName('')
  }

  return (
    <AdderBox>
      <Input
        size="compact"
        type="text"
        value={name}
        maxLength={LEDGER_MAX_NAME}
        aria-label={playGamesCopy('newFactionName')}
        placeholder={playGamesCopy('factionName')}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
        style={NAME_INPUT}
      />
      <Button size="compact" disabled={!ready} onClick={commit}>
        {playGamesCopy('add')}
      </Button>
    </AdderBox>
  )
}

/** The Jobs list's intake: a name, who it is for, its pay and that pay's Tech Level, then Add. */
function JobAdder({
  disabled,
  factions,
  onAdd,
}: {
  disabled: boolean
  factions: readonly Faction[]
  onAdd: (terms: Omit<Job, 'id' | 'state'>) => Promise<unknown>
}) {
  const id = useId()
  const [name, setName] = useState('')
  const [factionId, setFactionId] = useState('')
  const [pay, setPay] = useState(10)
  const [payTl, setPayTl] = useState(1)
  const ready = name.trim().length > 0 && !disabled
  // A faction removed since it was chosen reads as anyone.
  const chosen = factions.some((f) => f.id === factionId) ? factionId : ''

  function commit() {
    if (!ready) return
    void onAdd({ name: name.trim(), factionId: chosen === '' ? null : chosen, pay, payTl })
    setName('')
  }

  return (
    <AdderBox>
      <Input
        size="compact"
        type="text"
        value={name}
        maxLength={LEDGER_MAX_NAME}
        aria-label={playGamesCopy('newJobName')}
        placeholder={playGamesCopy('jobName')}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
        style={NAME_INPUT}
      />
      <AdderField label={playGamesCopy('offeredBy')} htmlFor={`${id}-faction`}>
        <Select
          id={`${id}-faction`}
          className="su-text-input--compact"
          aria-label={playGamesCopy('jobFor')}
          value={chosen}
          onChange={(e) => setFactionId(e.target.value)}
        >
          <option value="">{playGamesCopy('nobody')}</option>
          {factions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </AdderField>
      <AdderField label={playGamesCopy('pay')} htmlFor={`${id}-pay`}>
        <Input
          size="compact"
          id={`${id}-pay`}
          aria-label={playGamesCopy('jobPay')}
          type="number"
          numeric
          min={0}
          max={LEDGER_MAX_PAY}
          step={1}
          value={pay}
          onChange={(e) => setPay(clamp(e.target.value, 0, LEDGER_MAX_PAY))}
          style={NUMBER_INPUT}
        />
      </AdderField>
      <AdderField label={playGamesCopy('tech')} htmlFor={`${id}-tl`}>
        <Input
          size="compact"
          id={`${id}-tl`}
          aria-label={playGamesCopy('jobPayTl')}
          type="number"
          numeric
          min={1}
          max={6}
          step={1}
          value={payTl}
          onChange={(e) => setPayTl(clamp(e.target.value, 1, 6))}
          style={NUMBER_INPUT}
        />
      </AdderField>
      <Button size="compact" disabled={!ready} onClick={commit}>
        {playGamesCopy('add')}
      </Button>
    </AdderBox>
  )
}
