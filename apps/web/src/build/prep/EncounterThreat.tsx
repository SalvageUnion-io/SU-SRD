/**
 * An encounter's threat read and spoils on its page (ADR-059 §5), from
 * `threat.model.ts`: the read under the opposition, set against a crew the
 * Mediator steps to size, and the spoils beside the notes. Both read the
 * encounter and write nothing to it; the crew is remembered on this device.
 */

import type { Encounter } from 'game-domain/schemas/encounter'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Cluster, EmptyState, SlabSection, Stack, Stat, Text, tokens } from '../../components/index'
import { localStore } from '../../lib/safeLocalStorage'
import { buildPrepCopy } from '../../messages/build-prep'
import type { Crew, Spoil } from './threat.model'
import {
  CREW_DEFAULT,
  CREW_SIZE_MAX,
  spoilsOf,
  TECH_LEVEL_MAX,
  techSpread,
  threatRead,
} from './threat.model'

const CREW_KEY = 'su.encounter.crew'

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const between = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max

/** The crew last stepped to on this device, or the default. */
function readCrew(): Crew {
  try {
    const raw = localStore()?.getItem(CREW_KEY)
    const v = raw ? (JSON.parse(raw) as Partial<Crew>) : null
    if (v && between(v.size, CREW_SIZE_MAX) && between(v.techLevel, TECH_LEVEL_MAX)) {
      return { size: v.size, techLevel: v.techLevel }
    }
  } catch {
    // A remembered crew is a convenience: unreadable, start from the default.
  }
  return CREW_DEFAULT
}

function writeCrew(crew: Crew): void {
  try {
    localStore()?.setItem(CREW_KEY, JSON.stringify(crew))
  } catch {
    // Storage refused: the crew lasts this visit only.
  }
}

/** The threat read (Core Book p.255), under the opposition. */
export function ThreatReadLine({
  encounter,
  editing,
}: {
  encounter: Encounter
  /** Edit: the crew steps. Read prints it, as every sheet's Read does (R11). */
  editing: boolean
}) {
  const [crew, setCrew] = useState(readCrew)
  const step = (next: Partial<Crew>) => {
    const value = { ...crew, ...next }
    setCrew(value)
    writeCrew(value)
  }
  const read = threatRead(encounter, crew)
  return (
    <SlabSection as="h3" size="mini" id="encounter-threat" title={buildPrepCopy('threatRead')}>
      <Stack gap={8}>
        <Cluster gap={8}>
          <Stat
            size="mini"
            label={buildPrepCopy('crew')}
            value={crew.size}
            mode={editing ? 'edit' : 'read'}
            min={1}
            ceiling={CREW_SIZE_MAX}
            stepperLabel={buildPrepCopy('crewSize')}
            onChange={(size) => step({ size })}
          />
          <Stat
            size="mini"
            label={buildPrepCopy('crewTech')}
            value={crew.techLevel}
            mode={editing ? 'edit' : 'read'}
            min={1}
            ceiling={TECH_LEVEL_MAX}
            stepperLabel={buildPrepCopy('crewTechLevel')}
            onChange={(techLevel) => step({ techLevel })}
          />
        </Cluster>
        <Cluster gap={8}>
          <Stat size="mini" label={buildPrepCopy('meetThem')} value={read.first} />
          {read.heldBack > 0 && (
            <Stat size="mini" label={buildPrepCopy('heldBack')} value={read.heldBack} />
          )}
          {read.techLevels && (
            <Stat size="mini" label={buildPrepCopy('tech')} value={techSpread(read.techLevels)} />
          )}
          {read.sp > 0 && <Stat size="mini" label={buildPrepCopy('sp')} value={read.sp} />}
          {read.hp > 0 && <Stat size="mini" label={buildPrepCopy('hp')} value={read.hp} />}
          {read.outnumbered === 'crew' && (
            <Stat size="mini" label={buildPrepCopy('crewOutnumbered')} state="caution" />
          )}
          {read.outnumbered === 'opposition' && (
            <Stat size="mini" label={buildPrepCopy('oppositionOutnumbered')} state="good" />
          )}
          {read.tech === 'higher' && (
            <Stat size="mini" label={buildPrepCopy('higherTech')} state="caution" />
          )}
          {read.tech === 'lower' && (
            <Stat size="mini" label={buildPrepCopy('lowerTech')} state="good" />
          )}
        </Cluster>
        <Text variant="note">{buildPrepCopy('threatNote')}</Text>
      </Stack>
    </SlabSection>
  )
}

/** The spoils (Core Book p.246, 269): what each opponent could leave behind. */
export function EncounterSpoils({
  encounter,
  editing,
}: {
  encounter: Encounter
  /** Read leaves the section out when there is nothing to salvage (R11). */
  editing: boolean
}) {
  const spoils = spoilsOf(encounter)
  if (!editing && spoils.length === 0) return null
  return (
    <SlabSection
      as="h2"
      id="encounter-spoils"
      title={buildPrepCopy('spoils')}
      count={String(spoils.length)}
    >
      <Stack gap={12}>
        <Text variant="note">{buildPrepCopy('spoilsLede')}</Text>
        {spoils.length === 0 ? (
          <EmptyState variant="inline" body={buildPrepCopy('noSpoils')} />
        ) : (
          <ul style={LIST} aria-label={buildPrepCopy('spoils')}>
            {spoils.map((spoil) => (
              <li key={spoil.opponent.id}>
                <SpoilLines spoil={spoil} />
              </li>
            ))}
          </ul>
        )}
      </Stack>
    </SlabSection>
  )
}

function SpoilLines({ spoil }: { spoil: Spoil }) {
  if (spoil.kind === 'scrap') {
    return (
      <Stack gap={4}>
        <Text as="h3">{spoil.opponent.name}</Text>
        <Text variant="body">
          {spoil.techLevel === null
            ? buildPrepCopy('scrap', { value: spoil.salvageValue })
            : buildPrepCopy('scrapTech', { value: spoil.salvageValue, tech: spoil.techLevel })}
        </Text>
      </Stack>
    )
  }
  const { chassis, systems, modules } = spoil
  const bare = systems.length === 0 && modules.length === 0
  return (
    <Stack gap={4}>
      <Text as="h3">{spoil.opponent.name}</Text>
      {chassis.salvageValue !== null && (
        <Text variant="body">
          {chassis.techLevel === null
            ? buildPrepCopy('chassisSalvage', { name: chassis.name, value: chassis.salvageValue })
            : buildPrepCopy('chassisSalvageTech', {
                name: chassis.name,
                tech: chassis.techLevel,
                value: chassis.salvageValue,
              })}
        </Text>
      )}
      {bare ? (
        <Text variant="note">{buildPrepCopy('noLoadout')}</Text>
      ) : (
        <>
          {systems.length > 0 && (
            <Text variant="body">
              <strong>{buildPrepCopy('systems')}:</strong> {systems.join(', ')}
            </Text>
          )}
          {modules.length > 0 && (
            <Text variant="body">
              <strong>{buildPrepCopy('modules')}:</strong> {modules.join(', ')}
            </Text>
          )}
        </>
      )}
    </Stack>
  )
}
