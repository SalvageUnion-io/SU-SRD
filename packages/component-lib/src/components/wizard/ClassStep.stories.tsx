import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { ClassDetail, ClassOptionList } from './ClassStep'
import { selectableClasses } from './classOptions'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Class Step',
}

const { base, specialisations } = selectableClasses(undefined, true)

/** The pilot class picker: option list on one side, the chosen class's detail on the other. */
export const Default: Story = () => {
  const [selectedClassId, setSelectedClassId] = useState(base[0]?.id ?? '')
  const selectedClass = [...base, ...specialisations].find((c) => c.id === selectedClassId)
  return (
    <div className="sheet--pilot flex flex-col gap-8 bg-paper p-4">
      <div>
        <Caption>ClassOptionList</Caption>
        <ClassOptionList
          base={base}
          specialisations={specialisations}
          selectedClassId={selectedClassId}
          onSelect={setSelectedClassId}
        />
      </div>
      <div>
        <Caption>ClassDetail</Caption>
        <ClassDetail selectedClass={selectedClass} />
      </div>
    </div>
  )
}
