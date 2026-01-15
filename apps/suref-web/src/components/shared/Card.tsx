import { Flex, type FlexProps } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import type { SURefEnumSource } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { getSourceStyles } from '../entity/entityDisplayHelpers'

type CardProps = Omit<FlexProps, 'bg' | 'children' | 'borderColor' | 'direction'> & {
  /** Background color token (e.g., 'bg.builder.pilot', 'su.orange', 'su.green') */
  bg?: string
  /** Optional background color for the header section (defaults to bg if not provided) */
  headerBg?: string
  /** Optional opacity for the header section (0-1, defaults to 1) */
  headerOpacity?: number
  /** Optional title to display at the top */
  title?: string
  /** Optional content to display on the left side of the header (e.g., buttons, stats) */
  leftContent?: ReactNode
  /** Optional content to display on the right side of the header (e.g., buttons, stats) */
  rightContent?: ReactNode
  /** Optional content to display below the header (e.g., subtitle, details) */
  subTitleContent?: ReactNode
  /** Main content of the box */
  children?: ReactNode
  /** Optional rotation for the title in degrees */
  titleRotation?: number
  /** Whether the box is disabled (grays out background and makes title opaque) */
  disabled?: boolean
  /** Optional background color for body (if different from header) */
  bodyBg?: string
  /** Optional padding for body section */
  bodyPadding?: number | string
  /** Optional click handler for the header */
  onHeaderClick?: () => void
  /** Optional test ID for the header container */
  headerTestId?: string
  /** Optional absolute positioned elements (e.g., level display) */
  absoluteElements?: ReactNode
  /** Optional label displayed as pseudo-header above the box */
  label?: string
  /** Whether to use compact styling */
  compact?: boolean
  /** Whether to reverse the header layout (title on right, rightContent on left) */
  reverse?: boolean
  /** Optional source book for source-based styling */
  source?: SURefEnumSource
  /** Whether the entity is expanded (affects source styling) */
  isExpanded?: boolean
}

export function Card({
  label,
  compact = false,
  bg = 'su.lightBlue',
  headerBg,
  headerOpacity = 1,
  title,
  leftContent,
  rightContent,
  subTitleContent,
  children,
  absoluteElements,
  justifyContent = 'space-between',
  titleRotation = 0,
  disabled = false,
  bodyBg,
  bodyPadding,
  onHeaderClick,
  headerTestId,
  reverse = false,
  source,
  isExpanded = true,
  ...flexProps
}: CardProps) {
  const actualHeaderBg = disabled ? 'su.grey' : headerBg || bg
  const actualBodyBg = disabled ? 'su.grey' : bodyBg || bg

  const hasHeader = !!(title || leftContent || rightContent)
  const headerCursor = onHeaderClick ? 'pointer' : 'default'
  const headerBottomRadius = children ? '0' : 'xs'

  // Source-based styling using shared helper function (only when expanded)
  const sourceHeaderStyles = getSourceStyles(source, disabled, 'header', isExpanded)

  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent={justifyContent}
      bg={actualBodyBg}
      borderRadius="md"
      p={0}
      shadow="lg"
      overflow="visible"
      minH="fit-content"
      flexShrink={0}
      position="relative"
      {...flexProps}
    >
      {absoluteElements}
      {label && (
        <Text
          position="absolute"
          variant="pseudoheader"
          fontSize="sm"
          textTransform="uppercase"
          ml={3}
          mt={-2}
          {...(compact && {
            whiteSpace: 'nowrap',
            maxW: '80%',
            css: {
              transformOrigin: 'left center',
              transform: 'scaleX(0.85)',
            },
          })}
        >
          {label}
        </Text>
      )}
      {hasHeader && (
        <Flex
          direction={reverse ? 'row-reverse' : 'row'}
          w="full"
          px="0"
          gap={2}
          cursor={headerCursor}
          justifyContent={'space-between'}
          onClick={onHeaderClick}
          alignItems="center"
          data-testid={headerTestId}
          p={compact ? 1 : 2}
          borderTopRadius="xs"
          borderBottomRadius={headerBottomRadius}
          bg={actualHeaderBg}
          opacity={headerOpacity}
          h={compact ? '70px' : 'auto'}
          minH={compact ? '70px' : '100px'}
          borderBottomWidth="0"
          overflow="visible"
          css={{
            ...sourceHeaderStyles,
          }}
        >
          <Flex alignItems="center" gap={compact ? 0.5 : 1}>
            {leftContent}
            <Flex
              direction="column"
              gap={compact ? 0.5 : 1}
              justifyContent="center"
              h="full"
              overflow="visible"
              minW="0"
              alignItems={reverse ? 'flex-end' : 'flex-start'}
            >
              {title && (
                <Text
                  variant="pseudoheader"
                  textTransform="uppercase"
                  transform={titleRotation !== 0 ? `rotate(${titleRotation}deg)` : undefined}
                  transition="transform 0.3s ease"
                  opacity={disabled ? 0.5 : 1}
                  whiteSpace={compact ? 'normal' : 'nowrap'}
                  overflow={compact ? 'visible' : 'hidden'}
                  textOverflow={compact ? 'clip' : 'ellipsis'}
                  fontSize={compact ? '1rem' : '2rem'}
                  lineHeight={compact ? '1.2' : 'normal'}
                  textAlign={reverse ? 'right' : 'left'}
                >
                  {title}
                </Text>
              )}
              {subTitleContent && (
                <Flex
                  overflow="visible"
                  flexWrap="wrap"
                  alignItems="center"
                  zIndex={10}
                  justifyContent={reverse ? 'flex-end' : 'flex-start'}
                  gap={compact ? 1 : 2}
                >
                  {subTitleContent}
                </Flex>
              )}
            </Flex>
          </Flex>
          {rightContent}
        </Flex>
      )}
      {children && (
        <Flex
          direction="column"
          alignItems="center"
          w="full"
          p={bodyPadding ?? 4}
          flex="1"
          borderBottomRadius="md"
        >
          {children}
        </Flex>
      )}
    </Flex>
  )
}
