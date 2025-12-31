import { StatDisplay } from '../StatDisplay'

interface AddStatButtonProps {
  onClick: () => void
  disabled?: boolean
  label?: string
  bottomLabel?: string
  ariaLabel?: string
}

/**
 * Reusable "Add" button component using StatDisplay styling
 * Used consistently across inventory, cargo, abilities, systems, etc.
 */
export function AddStatButton({
  onClick,
  disabled = false,
  label = 'Add',
  bottomLabel,
  ariaLabel,
}: AddStatButtonProps) {
  return (
    <StatDisplay
      label={label}
      bottomLabel={bottomLabel}
      value="+"
      disabled={disabled}
      onClick={onClick}
      bg="brand.srd"
      valueColor="su.white"
      ariaLabel={ariaLabel}
    />
  )
}
