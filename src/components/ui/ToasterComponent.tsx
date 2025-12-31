'use client'

import { Toaster as ChakraToaster, Portal, Spinner, Stack, Toast } from '@chakra-ui/react'
import { toaster } from './toaster'

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: '4' }}>
        {(toast) => (
          <Toast.Root width="auto" minWidth="250px">
            {toast.type === 'loading' && <Spinner size="sm" color="su.orange" />}
            <Stack gap="1" flex="1" maxWidth="100%" direction="column">
              {toast.title && <Toast.Title whiteSpace="nowrap">{toast.title}</Toast.Title>}
              {toast.description && <Toast.Description>{toast.description}</Toast.Description>}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger asChild>
                <button>{toast.action.label}</button>
              </Toast.ActionTrigger>
            )}
            {toast.meta?.closable !== false && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}
