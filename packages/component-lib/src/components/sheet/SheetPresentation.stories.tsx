import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { Stat } from '../shared/Stat'
import { ConditionsEditor } from './ConditionsEditor'
import { CrawlerEconFrame } from './CrawlerEcon'
import { ChassisStats, SheetHero } from './SheetHero'

export default {
  title: 'Compositions/Sheet Presentation',
}

// Real SRD data — a mech sheet's hero is driven by a chassis.
const chassis = SalvageUnionReference.Chassis.all()[0]

/**
 * The live-sheet POSTER presentation, lifted out of ITUN: the hero band, the
 * crawler economy frame, and the two condition controls. These are pure
 * presentation — the app supplies the values and the save handlers.
 */
export const Default: Story = () => {
  const [conditions, setConditions] = useState<string[]>(['Impaired'])

  return (
    <div className="sheet--mech flex flex-col gap-10 bg-paper p-4">
      <div>
        <Caption>SheetHero — the poster identity band</Caption>
        <SheetHero
          cat="MECH"
          name={chassis?.name ?? 'Mule'}
          specs={
            <ChassisStats
              items={[
                { code: 'SP', value: 10, max: 10 },
                { code: 'EP', value: 5, max: 5 },
                { code: 'HEAT', value: 0, max: 4 },
              ]}
            />
          }
          trackers={<Stat label="SP" value={10} max={10} />}
        />
      </div>

      <div>
        <Caption>CrawlerEconFrame — the crawler economy lozenges</Caption>
        <CrawlerEconFrame
          gauge={<Stat label="SP" value={20} max={25} />}
          items={[
            { label: 'Upkeep', value: 12, caption: 'Scrap · Tech 2+' },
            { label: 'Cargo', value: 6, max: 10 },
          ]}
        />
      </div>

      <div>
        <Caption>ConditionsEditor — the pilot/mech condition list</Caption>
        <ConditionsEditor conditions={conditions} onChange={(next) => setConditions(next)} />
      </div>
    </div>
  )
}
