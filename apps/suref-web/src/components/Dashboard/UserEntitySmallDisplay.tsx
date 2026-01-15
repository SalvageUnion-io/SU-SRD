import type { ReactNode } from 'react'
import type { BoxProps } from '@chakra-ui/react'
import { Flex } from '@chakra-ui/react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { Text } from '../base/Text'
import { Card } from '../shared/Card'
import { ValueDisplay } from '../shared/ValueDisplay'

interface UserEntitySmallDisplayProps extends Omit<BoxProps, 'onClick'> {
  /** Navigation target (when provided, component becomes a link) */
  to?: LinkProps['to']
  /** Route params for navigation */
  params?: LinkProps['params']
  /** Click handler (only used when to is not provided) */
  onClick?: () => void
  /** Mouse enter handler for prefetching */
  onMouseEnter?: () => void
  /** Background color for the entire card */
  bgColor: string
  /** Left header content (entity name) - larger pseudoheader */
  leftHeader: string
  /** Right header content (note/category) - smaller pseudoheader or custom ReactNode */
  rightHeader?: string | ReactNode
  /** Detail content below header */
  detailContent?: ReactNode
  /** Label for detail content (e.g. "Role") */
  detailLabel?: string
  /** Value for detail content (e.g. "Mediator") */
  detailValue?: string | number
  /** Whether this entity is inactive (applies greyed out styling) */
  isInactive?: boolean
  /** Optional label displayed as pseudo-header above the box */
  label?: string
  reverse?: boolean
  /** Optional delete button to display in the header */
  deleteButton?: ReactNode
}

export function UserEntitySmallDisplay({
  to,
  params,
  onClick,
  onMouseEnter,
  reverse = false,
  label,
  bgColor,
  leftHeader,
  detailLabel,
  detailValue,
  rightHeader,
  isInactive = false,
  deleteButton,
}: UserEntitySmallDisplayProps) {
  const effectiveBgColor: string = isInactive ? 'gray.400' : bgColor

  const formattedRightHeader =
    typeof rightHeader === 'string' ? (
      <Text variant="pseudoheader" fontSize="sm" lineClamp={2} textAlign="right" flexShrink={0}>
        {rightHeader}
      </Text>
    ) : (
      rightHeader
    )

  const cardContent = (
    <Card
      minH="90px"
      reverse={reverse}
      bg={effectiveBgColor}
      label={label}
      title={leftHeader}
      rightContent={formattedRightHeader}
      subTitleContent={
        detailLabel && <ValueDisplay label={detailLabel} value={detailValue} inline={false} />
      }
      _hover={{ borderColor: 'brand.srd' }}
      cursor="pointer"
      onClick={to ? undefined : onClick}
      onMouseEnter={onMouseEnter}
      w="full"
      opacity={isInactive ? 0.7 : 1}
    >
      {deleteButton && (
        <Flex justifyContent="flex-end" p={2} position="absolute" bottom={0} right={0}>
          {deleteButton}
        </Flex>
      )}
    </Card>
  )

  if (to) {
    return (
      <Link
        to={to}
        params={params}
        style={{ textDecoration: 'none', display: 'block', width: '100%' }}
        onMouseEnter={onMouseEnter}
      >
        {cardContent}
      </Link>
    )
  }

  return cardContent
}
