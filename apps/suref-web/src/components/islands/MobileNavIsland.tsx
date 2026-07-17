import { MobileNavDrawer } from 'suref-react'
import { SearchIsland } from './SearchIsland'
import { ITUN_URL } from '../../lib/constants'

type SchemaLink = {
  id: string
  displayName: string
  catalogBg: string
  catalogLabel?: string
  href?: string
}

type SchemaCategory = {
  label: string
  schemas: SchemaLink[]
}

type MobileNavIslandProps = {
  categories: SchemaCategory[]
  currentPath: string
}

/**
 * Hydrates the shared MobileNavDrawer for the SRD top nav, wiring in the site's
 * live SearchIsland combobox and the outbound builder URL. The drawer chrome
 * itself lives in suref-react; this island supplies the SRD-specific data +
 * search behaviour.
 */
export function MobileNavIsland({ categories, currentPath }: MobileNavIslandProps) {
  return (
    <MobileNavDrawer
      categories={categories}
      currentPath={currentPath}
      itunUrl={ITUN_URL}
      search={<SearchIsland />}
    />
  )
}
