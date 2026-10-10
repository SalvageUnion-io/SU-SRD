import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { OgCard } from './OgCard'

export default {
  title: 'Compositions/Og Card',
}

// Real SRD content — reference data is preloaded by catalog.tsx.
const scrapper = SalvageUnionReference.Chassis.getByName('Scrapper')
const repair = SalvageUnionReference.Abilities.getByName('Mass Field Repair')

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[32],
  overflowX: 'auto',
} satisfies CSSProperties

/**
 * The link preview at full size, 1200 × 630, for each of the six cards on
 * canvas board PV1: a reference thing and a thing you do (the SRD renders
 * both at build), a player's sheet, a user-made pattern and NPC, a Game
 * invite, and the plain card for anything private (ITUN renders these on
 * request). The SRD builds its two from the entity with `ogCardForEntity`;
 * these carry the same Scrapper and Mass Field Repair values.
 */
export const Default: Story = () => (
  <div style={STACK}>
    {scrapper && (
      <div>
        <Caption>reference thing — tone band, solid frame, stat boxes, page cite</Caption>
        <OgCard
          kind="thing"
          kicker={`Chassis · Tech Level ${scrapper.techLevel}`}
          title={scrapper.name}
          tone={color.mech}
          stats={[
            { label: 'SP', value: String(scrapper.structurePoints) },
            { label: 'EP', value: String(scrapper.energyPoints) },
            { label: 'Heat', value: String(scrapper.heatCapacity) },
            { label: 'SYS', value: String(scrapper.systemSlots) },
            { label: 'MOD', value: String(scrapper.moduleSlots) },
            { label: 'Cargo', value: String(scrapper.cargoCapacity) },
          ]}
          cite={`${scrapper.source} · p.${scrapper.page}`}
          address="salvageunion.io/schema/chassis/item/scrapper"
        />
      </div>
    )}
    {repair && (
      <div>
        <Caption>reference do — the ink band, tier numeral, cost pennant, rules</Caption>
        <OgCard
          kind="do"
          kicker={`Ability · ${repair.tree} · Long · Close`}
          title={repair.name}
          tier={String(repair.level)}
          cost="X AP"
          rules="You repair any number of damaged Mech Chassis, Vehicles, Systems, or Modules within Range to Intact Condition."
          cite={`${repair.source} · p.${repair.page}`}
          address="salvageunion.io/schema/abilities/item/mass-field-repair"
        />
      </div>
    )}
    <div>
      <Caption>a player's sheet — built from canon, so solid</Caption>
      <OgCard
        kind="sheet"
        kicker="Pilot · Engineer"
        title="Bonesaw"
        tone={color.pilot}
        stats={[
          { label: 'HP', value: '8/10' },
          { label: 'AP', value: '3/5' },
          { label: 'TP', value: '2' },
          { label: 'Mech', value: 'Scrapper' },
        ]}
        byline="Rosa's pilot · Reclamation of the Wastes"
        address="itun.salvageunion.io/p/pilot/bonesaw"
      />
    </div>
    <div>
      <Caption>user-made pattern — dashed frame, hatched band, User-made stamp</Caption>
      <OgCard
        kind="userMade"
        kicker="Mech Pattern · Scrapper"
        title="Tow Rig"
        tone={color.mech}
        stats={[
          { label: 'TL', value: '1' },
          { label: 'SYS', value: '12/12' },
          { label: 'MODS', value: '2/2' },
          { label: 'SP', value: '9' },
        ]}
        madeBy="alxjrvs"
        address="itun.salvageunion.io/p/pattern/tow-rig"
      />
    </div>
    <div>
      <Caption>user-made NPC — the same treatment on the adversary tone</Caption>
      <OgCard
        kind="userMade"
        kicker="NPC · From Veteran"
        title="Sergeant Kessler"
        tone={color.adversary}
        stats={[
          { label: 'HP', value: '9' },
          { label: 'Actions', value: '2' },
        ]}
        madeBy="alxjrvs"
        quoted={false}
        address="itun.salvageunion.io/p/npc/sergeant-kessler"
      />
    </div>
    <div>
      <Caption>Game invite — never the token</Caption>
      <OgCard
        kind="invite"
        kicker="You're invited · Player seat"
        title="Reclamation of the Wastes"
        tone={color.crawler}
        summary="Mediated by alxjrvs."
        terms="Link expires 15 Oct · the Mediator lets you in"
        address="itun.salvageunion.io"
      />
    </div>
    <div>
      <Caption>a long player-typed name — one line, stepped down, then an ellipsis</Caption>
      <OgCard
        kind="userMade"
        kicker="NPC · From Veteran"
        title="Sergeant Kessler of the Ninth Reclamation Wing, Retired"
        tone={color.adversary}
        stats={[
          { label: 'HP', value: '9' },
          { label: 'Actions', value: '2' },
        ]}
        madeBy="alxjrvs"
        quoted={false}
        address="itun.salvageunion.io/p/npc/kessler"
      />
    </div>
    <div>
      <Caption>private — no name, no stats, no maker</Caption>
      <OgCard kind="private" address="itun.salvageunion.io" />
    </div>
  </div>
)
