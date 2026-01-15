import { Flex } from '@chakra-ui/react'
import type { SURefClass } from 'salvageunion-reference'
import { LiveSheetAssetDisplay } from '../../shared/LiveSheetAssetDisplay'
import { PilotInfoInputs } from '../../PilotLiveSheet/PilotInfoInputs'
import { PilotResourceSteppers } from '../../PilotLiveSheet/PilotResourceSteppers'
import { useHydratedPilot } from '../../../hooks/pilot'
import { useImageUpload } from '../../../hooks/useImageUpload'

interface PilotSectionProps {
  id: string
  isEditable: boolean
  isLocal: boolean
}

export function PilotSection({ id, isEditable, isLocal }: PilotSectionProps) {
  const { pilot, selectedClass, selectedAdvancedClass } = useHydratedPilot(id)

  const selectedClassRef = selectedClass?.ref as SURefClass | undefined
  const selectedAdvancedClassRef = selectedAdvancedClass?.ref as SURefClass | undefined

  // Use hybrid class asset_url if hybrid class is selected and no custom photo is uploaded
  // Otherwise, use core class asset_url
  const defaultAssetUrl = selectedAdvancedClassRef?.asset_url ?? selectedClassRef?.asset_url
  const defaultAlt = selectedAdvancedClassRef?.name ?? selectedClassRef?.name

  const { handleUpload, isUploading } = useImageUpload({
    entityType: 'pilots',
    entityId: id,
    getCurrentImageUrl: () => pilot?.image_url ?? null,
    queryKey: ['pilots', id],
  })

  return (
    <Flex
      gap={2}
      w="full"
      direction={{ base: 'column', lg: 'row' }}
      alignItems={{ base: 'stretch', lg: 'stretch' }}
    >
      <LiveSheetAssetDisplay
        bg={selectedClass ? 'su.orange' : 'su.grey'}
        url={defaultAssetUrl}
        userImageUrl={(pilot as { image_url?: string })?.image_url}
        alt={defaultAlt}
        onUpload={!isLocal && isEditable ? handleUpload : undefined}
        isUploading={isUploading}
      />

      <PilotInfoInputs disabled={!isEditable} incomplete={!selectedClass} id={id} />

      <PilotResourceSteppers id={id} disabled={!isEditable} incomplete={!selectedClass} />
    </Flex>
  )
}
