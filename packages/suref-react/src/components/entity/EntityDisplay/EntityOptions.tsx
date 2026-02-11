import { SheetDisplay } from '../../shared/SheetDisplay'
import { EntitySubheader } from './EntitySubheader'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { cn } from '../../../utils/cn'

/**
 * EntityOptions component
 *
 * Note: Since EntityDisplay now only accepts SURefEntity (not SURefMetaAction),
 * and options only exist on SURefMetaAction, this component will never render.
 * It's kept for backward compatibility but will always return null.
 */
export function EntityOptions() {
  const { data, spacing, compact } = useEntityDisplayContext()

  if (!('options' in data)) return null

  const options = (data as { options?: Array<string | { label: string; value: string }> }).options

  if (!options || options.length === 0) return null

  return (
    <div
      className={cn(
        'flex flex-col items-stretch rounded-md',
        spacing.smallGap <= 1.5 ? 'gap-1.5' : 'gap-2'
      )}
      style={{
        paddingLeft: `${spacing.contentPaddingX}rem`,
        paddingRight: `${spacing.contentPaddingX}rem`,
        paddingTop: `${spacing.contentPadding}rem`,
        paddingBottom: `${spacing.contentPadding}rem`,
      }}
    >
      <EntitySubheader label="Options" />
      <div className="flex flex-col items-stretch" style={{ gap: `${spacing.contentPadding}rem` }}>
        {options.map((option, optIndex) => {
          const label = typeof option === 'string' ? '' : option.label
          const value = typeof option === 'string' ? option : option.value
          return <SheetDisplay compact={compact} key={optIndex} label={label} value={value} />
        })}
      </div>
    </div>
  )
}
