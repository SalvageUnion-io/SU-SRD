import type { SURefEntity } from 'salvageunion-reference'
import { getRequirement } from 'salvageunion-reference'
import { SheetDisplay } from '../../shared/SheetDisplay'
import { Text } from '../../base/Text'
import { Fragment } from 'react/jsx-runtime'

type ReferenceEntityRequirementDisplayProps = {
  data: SURefEntity
  compact: boolean
}

export function ReferenceEntityRequirementDisplay({
  data,
  compact,
}: ReferenceEntityRequirementDisplayProps) {
  const requirement = getRequirement(data)
  if (!requirement || requirement.length === 0) return null

  return (
    <div className="flex">
      <SheetDisplay compact={compact} label="Requirements" labelColor="text-brand-srd">
        {requirement.map((req, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static requirement list from reference data; index disambiguates repeated tree names
          <Fragment key={`${req}-${index}`}>
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
