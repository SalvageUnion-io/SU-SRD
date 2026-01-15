import { Button, type ButtonProps } from '@chakra-ui/react'
import { Link, type LinkProps } from '@tanstack/react-router'

interface NavigationLinkProps
  extends Omit<ButtonProps, 'onClick'>,
    Pick<LinkProps, 'to' | 'params' | 'search'> {
  /** Whether this link is currently active */
  isActive: boolean
  /** Link text */
  children: React.ReactNode
}

/**
 * Consistent navigation link component
 * Used in TopNavigation for uniform styling
 */
export function NavigationLink({
  isActive,
  to,
  params,
  search,
  children,
  ...props
}: NavigationLinkProps) {
  return (
    <Button
      asChild
      px={4}
      py={2}
      _hover={{ bg: 'bg.hover' }}
      bg={isActive ? 'bg.active' : 'transparent'}
      borderBottomWidth={isActive ? '3px' : 0}
      borderBottomColor="su.orange"
      color="fg.default"
      fontWeight={isActive ? 'semibold' : 'normal'}
      borderRadius="md"
      variant="ghost"
      h="auto"
      w={{ base: 'full', lg: 'auto' }}
      {...props}
    >
      <Link to={to} params={params} search={search}>
        {children}
      </Link>
    </Button>
  )
}
