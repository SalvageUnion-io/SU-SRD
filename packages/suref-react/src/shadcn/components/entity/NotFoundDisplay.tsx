import { Heading } from '../base/Heading'

type NotFoundDisplayProps = {
  /** The type of entity that was not found (e.g., "System", "Module") */
  entityType?: string
  /** The ID or name that was searched for */
  entityId?: string
  /** Optional callback when user clicks close/dismiss */
  onClose?: () => void
}

/**
 * Display component shown when an entity cannot be found in the reference data.
 * Styled to match the existing error component aesthetic.
 */
export function NotFoundDisplay({ entityType, entityId, onClose }: NotFoundDisplayProps) {
  return (
    <div className="flex min-h-[200px] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-md border-2 border-brand-srd bg-su-blue-light p-6 shadow-lg">
        <Heading level={2} className="mb-4 text-xl font-bold">
          DATA NOT FOUND
        </Heading>
        <p className="mb-4 text-su-black">
          {entityType && entityId
            ? `The ${entityType} "${entityId}" could not be found in the reference data.`
            : entityId
              ? `The item "${entityId}" could not be found in the reference data.`
              : 'The requested item could not be found in the reference data.'}
        </p>
        <p className="mb-4 text-sm text-su-black">
          This may be a broken link or the data may have been removed.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="w-full cursor-pointer rounded-md bg-su-orange px-4 py-2 font-medium text-su-white hover:bg-brand-srd"
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}
