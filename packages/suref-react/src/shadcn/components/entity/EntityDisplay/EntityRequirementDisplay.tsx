import { SheetDisplay } from '../../shared/SheetDisplay'
import { Text } from '../../base/Text'
import { Fragment } from 'react/jsx-runtime'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { getRequirement } from 'salvageunion-reference'

export function EntityRequirementDisplay() {
  const { data, spacing, compact } = useEntityDisplayContext()
  const requirement = getRequirement(data)
  if (!requirement || requirement.length === 0) return null

  return (
    <div
      className="flex"
      style={{
        paddingLeft: `${spacing.contentPaddingX}rem`,
        paddingRight: `${spacing.contentPaddingX}rem`,
        paddingTop: `${spacing.contentPadding}rem`,
        paddingBottom: `${spacing.contentPadding}rem`,
      }}
    >
      <SheetDisplay compact={compact} label="Requirements" labelColor="text-brand-srd">
        {requirement.map((req, index) => (
          <Fragment key={req + '-' + index}>
            <Text as="span">
              <Text as="span" className="font-bold">
                {req}
                {' tree'}
              </Text>
            </Text>
            {index < requirement.length - 1 && <Text>OR</Text>}
          </Fragment>
        ))}
      </SheetDisplay>
    </div>
  )
}
