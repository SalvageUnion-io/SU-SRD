import { NavDrawer, Badge, type NavDrawerItem } from 'component-lib'
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

const SRD_BRAND = (
  <a href="/">
    <span className="inline-flex shrink-0 cursor-pointer border border-ink">
      {/* `text-xl` sits above the stamp ladder's top rung (`full` = `text-sm`),
          so the wordmark keeps an explicit font-size override. */}
      <Badge shape="stamp" size="full" className="px-1 py-0.5 text-xl tracking-tight">
        Salvage Union
      </Badge>
      {/* `ring-0`: the outer span draws the ink frame. */}
      <Badge
        shape="stamp"
        size="full"
        surface="inverse"
        className="px-1 py-0.5 text-xl tracking-tight ring-0"
      >
        SRD
      </Badge>
    </span>
  </a>
)

/**
 * Hydrates the shared NavDrawer for the SRD top nav, wiring in the site's live
 * SearchIsland combobox, the schema-catalog tiles, and the secondary nav. The
 * drawer chrome lives in component-lib; this island supplies the SRD-specific
 * data + search behaviour.
 */
export function MobileNavIsland({ categories, currentPath }: MobileNavIslandProps) {
  const isActive = (path: string) => currentPath.startsWith(path)

  const navItems: NavDrawerItem[] = [
    { label: 'ABOUT', href: '/about/', active: isActive('/about') },
    { label: 'CHANGELOG', href: '/changelog/', active: isActive('/changelog') },
    { label: 'DISCORD', href: '/discord/', active: isActive('/discord') },
    { label: 'BUILDER ↗', href: ITUN_URL, external: true },
    {
      label: 'BUY THE GAME',
      href: 'https://leyline.press/collections/salvage-union',
      external: true,
    },
  ]

  return (
    <NavDrawer
      brand={SRD_BRAND}
      categories={categories}
      search={<SearchIsland />}
      navItems={navItems}
    />
  )
}
