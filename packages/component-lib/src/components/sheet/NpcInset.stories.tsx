import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { Button } from '../chrome/Button'
import { NpcFactsEditor } from './NpcFactsEditor'
import { NpcInset } from './NpcInset'
import { SheetActionsMenu } from './SheetActionsMenu'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/NPC Inset',
}

/** A crawler bay's resident NPC — every field inline-editable in place. */
export const Default: Story = () => {
  const [name, setName] = useState('Sparks')
  const [hp, setHp] = useState(8)
  const [facts, setFacts] = useState<string[]>(['Owes the Union a favour'])
  return (
    <div className="sheet--crawler flex flex-col gap-8 bg-paper p-4">
      <div>
        <Caption>NpcInset — editable</Caption>
        <NpcInset
          bayName="Medical Bay"
          name={name}
          hp={hp}
          maxHp={10}
          keepsake="A cracked visor"
          motto="Everyone walks away."
          detail="Crawler medic, three tours in the wastes."
          facts={facts}
          onNameChange={setName}
          onHpChange={setHp}
          onFactsChange={setFacts}
        />
      </div>

      <div>
        <Caption>NpcFactsEditor — standalone</Caption>
        <NpcFactsEditor facts={facts} onChange={setFacts} npcLabel={name} />
      </div>

      <div>
        <Caption>SheetActionsMenu — the sheet's ⋯ overflow</Caption>
        <SheetActionsMenu>
          <Button surface="paper">Export</Button>
          <Button surface="paper">Duplicate</Button>
        </SheetActionsMenu>
      </div>
    </div>
  )
}
