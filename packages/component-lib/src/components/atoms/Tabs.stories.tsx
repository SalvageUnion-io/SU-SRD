import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { Tab, TabList, TabPanel, Tabs } from './Tabs'

/**
 * Tabs — one panel at a time, with the tabs keyboard model: focus a tab and
 * ArrowLeft/ArrowRight (or Home/End) move AND select. Shown over three real
 * SRD records, each panel its reference card.
 */
export default {
  title: 'Atoms/Tabs',
}

const STACK: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  maxWidth: 480,
}

const PANEL: CSSProperties = { marginTop: space[12] }

const subjects = [
  { value: 'chassis', label: 'Chassis', data: SalvageUnionReference.Chassis.all()[0] },
  { value: 'system', label: 'System', data: SalvageUnionReference.Systems.all()[0] },
  { value: 'module', label: 'Module', data: SalvageUnionReference.Modules.all()[0] },
] as const

type Subject = (typeof subjects)[number]['value']

export const Default: Story = () => {
  const [open, setOpen] = useState<Subject>('chassis')
  return (
    <div style={STACK}>
      <Caption>Focus a tab, then ArrowRight: the next tab opens.</Caption>
      <Tabs value={open} onValueChange={setOpen}>
        <TabList label="Reference">
          {subjects.map((s) => (
            <Tab key={s.value} value={s.value}>
              {s.label}
            </Tab>
          ))}
        </TabList>
        {subjects.map((s) => (
          <TabPanel key={s.value} value={s.value} style={PANEL}>
            {s.data ? <ReferenceEntityCard data={s.data} size="medium" /> : null}
          </TabPanel>
        ))}
      </Tabs>
    </div>
  )
}
