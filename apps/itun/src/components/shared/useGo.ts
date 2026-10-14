import { useRouter } from '@tanstack/react-router'

/** Go to an address in the app — through the router when there is one. */
export function useGo(): (to: string, search?: Record<string, string>) => void {
  const router = useRouter({ warn: false })
  return (to, search) => {
    if (router) {
      void router.navigate({ to, search } as never)
      return
    }
    const query = search ? `?${new URLSearchParams(search).toString()}` : ''
    window.location.assign(`${to}${query}`)
  }
}
