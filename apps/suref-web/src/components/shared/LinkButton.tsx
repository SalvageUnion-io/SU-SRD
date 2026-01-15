import { Link } from '@tanstack/react-router'
import { Button } from '@chakra-ui/react'

interface LinkButtonProps {
  to: string
  label: string
}

export function LinkButton({ to, label }: LinkButtonProps) {
  return (
    <Button
      asChild
      px={3}
      py={2}
      bg="white"
      color="black"
      borderWidth="2px"
      borderColor="black"
      borderRadius="md"
      fontFamily="mono"
      fontSize="sm"
      fontWeight="semibold"
      _hover={{ bg: 'gray.100' }}
    >
      <Link to={to}>{label}</Link>
    </Button>
  )
}
