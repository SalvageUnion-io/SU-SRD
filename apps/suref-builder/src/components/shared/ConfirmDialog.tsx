import { useRef, useCallback, useState } from 'react'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogBackdrop,
  DialogPositioner,
  Button,
} from '@chakra-ui/react'
import { Text } from 'suref-react'

type ConfirmDialogState = {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
}

type ConfirmDialogOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

/**
 * Hook that provides a confirm dialog to replace window.confirm().
 *
 * Returns a tuple of [confirm, ConfirmDialogComponent]:
 * - confirm(options): Promise<boolean> - shows dialog, resolves when user responds
 * - ConfirmDialogComponent: React element to render in your component tree
 *
 * @example
 * ```tsx
 * const [confirm, ConfirmDialog] = useConfirmDialog()
 *
 * const handleDelete = async () => {
 *   const ok = await confirm({ message: 'Delete this item?' })
 *   if (ok) deleteItem()
 * }
 *
 * return (
 *   <>
 *     <Button onClick={handleDelete}>Delete</Button>
 *     {ConfirmDialog}
 *   </>
 * )
 * ```
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: 'Confirm',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  })

  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setState({
        isOpen: true,
        title: options.title ?? 'Confirm',
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
      })
    })
  }, [])

  const handleClose = useCallback((confirmed: boolean) => {
    setState((prev) => ({ ...prev, isOpen: false }))
    resolveRef.current?.(confirmed)
    resolveRef.current = null
  }, [])

  const dialog = (
    <DialogRoot
      open={state.isOpen}
      onOpenChange={(e) => {
        if (!e.open) handleClose(false)
      }}
      placement="center"
      role="alertdialog"
    >
      <DialogBackdrop zIndex={1500} />
      <DialogPositioner zIndex={1500}>
        <DialogContent
          maxW="md"
          bg="su.mediumGrey"
          borderWidth="3px"
          borderColor="su.black"
          borderRadius="md"
          shadow="lg"
          zIndex={1500}
        >
          <DialogHeader pl={6} pr={6} pt={4} pb={2}>
            <Text variant="pseudoheader" fontSize="2xl" textTransform="uppercase">
              {state.title}
            </Text>
          </DialogHeader>
          <DialogBody px={6} py={3}>
            <Text color="fg.default" fontSize="md">
              {state.message}
            </Text>
          </DialogBody>
          <DialogFooter px={6} pb={4} pt={2} gap={3}>
            <Button
              onClick={() => handleClose(false)}
              bg="su.white"
              color="su.black"
              fontWeight="bold"
              borderWidth="2px"
              borderColor="su.black"
              borderRadius="md"
              _hover={{ bg: 'gray.100' }}
            >
              {state.cancelLabel}
            </Button>
            <Button
              onClick={() => handleClose(true)}
              bg="brand.srd"
              color="su.white"
              fontWeight="bold"
              borderWidth="2px"
              borderColor="su.black"
              borderRadius="md"
              _hover={{ opacity: 0.9 }}
            >
              {state.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  )

  return [confirm, dialog] as const
}

/**
 * Hook that provides an alert dialog to replace window.alert().
 *
 * Returns a tuple of [alert, AlertDialogComponent]:
 * - alert(options): Promise<void> - shows dialog, resolves when dismissed
 * - AlertDialogComponent: React element to render in your component tree
 */
export function useAlertDialog() {
  const [state, setState] = useState<{
    isOpen: boolean
    title: string
    message: string
  }>({
    isOpen: false,
    title: 'Notice',
    message: '',
  })

  const resolveRef = useRef<(() => void) | null>(null)

  const showAlert = useCallback((options: { title?: string; message: string }): Promise<void> => {
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve
      setState({
        isOpen: true,
        title: options.title ?? 'Notice',
        message: options.message,
      })
    })
  }, [])

  const handleClose = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }))
    resolveRef.current?.()
    resolveRef.current = null
  }, [])

  const dialog = (
    <DialogRoot
      open={state.isOpen}
      onOpenChange={(e) => {
        if (!e.open) handleClose()
      }}
      placement="center"
      role="alertdialog"
    >
      <DialogBackdrop zIndex={1500} />
      <DialogPositioner zIndex={1500}>
        <DialogContent
          maxW="md"
          bg="su.mediumGrey"
          borderWidth="3px"
          borderColor="su.black"
          borderRadius="md"
          shadow="lg"
          zIndex={1500}
        >
          <DialogHeader pl={6} pr={6} pt={4} pb={2}>
            <Text variant="pseudoheader" fontSize="2xl" textTransform="uppercase">
              {state.title}
            </Text>
          </DialogHeader>
          <DialogBody px={6} py={3}>
            <Text color="fg.default" fontSize="md">
              {state.message}
            </Text>
          </DialogBody>
          <DialogFooter px={6} pb={4} pt={2}>
            <Button
              onClick={handleClose}
              bg="brand.srd"
              color="su.white"
              fontWeight="bold"
              borderWidth="2px"
              borderColor="su.black"
              borderRadius="md"
              _hover={{ opacity: 0.9 }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  )

  return [showAlert, dialog] as const
}
