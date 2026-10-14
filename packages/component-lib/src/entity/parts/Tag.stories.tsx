import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Tag, Tags } from './Tags'
import { traitTags } from './tagItems'

/**
 * A trait as a chip (E9, E17): the horizontal `Stat` cell with its
 * parameter. Where it may link (`linkable`) it opens its glossary entry and
 * Peeks; inside a link it only Peeks. The Portable Flamethrower's own traits.
 */
export default {
  title: 'Compositions/Entity/Tag',
}

function flamethrowerTags() {
  const entity = SalvageUnionReference.Equipment.getByName('Portable Flamethrower')
  if (!entity) throw new Error('Tag story: no Portable Flamethrower')
  return traitTags(toEntityModel(entity).traits)
}

const ROW = { display: 'flex', flexWrap: 'wrap', gap: space[8] } as const

export const Rungs: Story = () => (
  <div style={{ display: 'grid', gap: space[16], padding: space[16] }}>
    {(['full', 'compact', 'mini'] as const).map((rung) => (
      <div key={rung}>
        <Caption>{rung}, linkable</Caption>
        <div style={ROW}>
          <Tags tags={flamethrowerTags()} rung={rung} linkable />
        </div>
      </div>
    ))}
  </div>
)

/** One tag on its own, as an SRD page's band sets each of its entity's traits. */
export const One: Story = () => {
  const [first] = flamethrowerTags()
  return <div style={{ padding: space[16] }}>{first && <Tag tag={first} linkable />}</div>
}
