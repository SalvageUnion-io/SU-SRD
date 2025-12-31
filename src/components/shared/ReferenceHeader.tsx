import { Box, type BoxProps } from '@chakra-ui/react'
import { Heading } from '../base/Heading'
import type { ReactNode } from 'react'

interface ReferenceHeaderProps extends Omit<BoxProps, 'title'> {
  title?: string | ReactNode
  children?: ReactNode
}

export function ReferenceHeader({ title, children, ...boxProps }: ReferenceHeaderProps) {
  return (
    <Box
      bg="su.lightBlue"
      shadow="sm"
      p={8}
      display="flex"
      flexDirection="column"
      alignItems="center"
      flex="0 0 auto"
      {...boxProps}
    >
      {title && (
        <Heading
          level="h1"
          mb={2}
          textAlign="center"
          alignSelf="center"
          bg={typeof title === 'string' ? undefined : 'transparent'}
          mx="auto"
          display={typeof title === 'string' ? 'inline-block' : 'flex'}
          justifyContent="center"
          width={typeof title === 'string' ? 'fit-content' : '100%'}
        >
          {title}
        </Heading>
      )}
      {children}
    </Box>
  )
}
