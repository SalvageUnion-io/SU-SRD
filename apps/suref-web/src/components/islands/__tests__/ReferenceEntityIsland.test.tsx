import { describe, it, expect } from 'bun:test'
import { render } from '@testing-library/react'
import { getEntitySchemas, getModel, getName } from 'salvageunion-reference'
import { ReferenceEntityIsland } from '../ReferenceEntityIsland'

const entitySchemas = getEntitySchemas()

for (const schema of entitySchemas) {
  const model = getModel(schema.id)
  if (!model) continue

  const entities = model.all()
  if (entities.length === 0) continue

  describe(`${schema.displayName} (${schema.id})`, () => {
    for (const entity of entities) {
      const entityName = getName(entity) ?? entity.id

      it(`renders "${entityName}"`, () => {
        const { container } = render(<ReferenceEntityIsland item={entity} />)
        expect(container.textContent).toContain(entityName)
      })
    }

    it(`renders first entity in compact mode`, () => {
      const firstEntity = entities[0]!
      const { container } = render(<ReferenceEntityIsland item={firstEntity} compact />)
      const entityName = getName(firstEntity) ?? firstEntity.id
      expect(container.textContent).toContain(entityName)
    })
  })
}
