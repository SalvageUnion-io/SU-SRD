import type { Story } from '@ladle/react'
import type { Crawler } from '../../types/common'

export default { title: 'Roster/CrawlerCard' }

// NOTE: CrawlerCard uses <Link> from @tanstack/react-router which requires
// a router context. We render the card's visual content directly here
// to avoid the router dependency. If a full router provider is added to
// .ladle/components.tsx in the future, switch to importing CrawlerCard directly.

import { Truck } from 'lucide-react'

const baseCrawler: Crawler = {
  id: 'mock-crawler-1',
  user_id: 'mock-user',
  name: 'Iron Nomad',
  crawler_ref: 'hauler',
  tech_level: 2,
  max_sp: 20,
  current_damage: 3,
  upkeep: 5,
  upgrade_level: 10,
  scrap_tl1: 5,
  scrap_tl2: 3,
  scrap_tl3: 1,
  scrap_tl4: 0,
  scrap_tl5: 0,
  scrap_tl6: 0,
  description: 'A sturdy hauler crawler',
  notes: '',
  image_url: null,
  active: true,
  private: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

function CrawlerCardPreview({ crawler }: { crawler: Crawler }) {
  return (
    <div className="group block rounded-xl border-2 border-crawler/30 bg-[var(--card)] p-4 transition-all hover:border-crawler hover:shadow-md cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-crawler/20 text-crawler">
          <Truck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold leading-tight">{crawler.name || 'Unnamed Crawler'}</h3>
          {crawler.crawler_ref && (
            <p className="text-xs capitalize text-su-grey-dark">{crawler.crawler_ref}</p>
          )}
          <div className="mt-2 flex gap-4 text-xs">
            <span>
              TL: <span className="font-bold">{crawler.tech_level}</span>
            </span>
            <span>
              SP:{' '}
              <span className="font-bold">
                {crawler.max_sp - crawler.current_damage}/{crawler.max_sp}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Default: Story = () => (
  <div className="max-w-sm">
    <CrawlerCardPreview crawler={baseCrawler} />
  </div>
)

export const Damaged: Story = () => (
  <div className="max-w-sm">
    <CrawlerCardPreview
      crawler={{
        ...baseCrawler,
        current_damage: 15,
      }}
    />
  </div>
)
Damaged.meta = {
  description: 'A heavily damaged crawler with 15 damage out of 20 max SP (5 SP remaining).',
}

export const NoDamage: Story = () => (
  <div className="max-w-sm">
    <CrawlerCardPreview
      crawler={{
        ...baseCrawler,
        current_damage: 0,
      }}
    />
  </div>
)
NoDamage.meta = {
  description: 'A crawler at full structural integrity.',
}

export const Unnamed: Story = () => (
  <div className="max-w-sm">
    <CrawlerCardPreview
      crawler={{
        ...baseCrawler,
        name: '',
      }}
    />
  </div>
)
Unnamed.meta = {
  description: 'A crawler with no name displays "Unnamed Crawler".',
}

export const NoCrawlerRef: Story = () => (
  <div className="max-w-sm">
    <CrawlerCardPreview
      crawler={{
        ...baseCrawler,
        crawler_ref: null,
        name: 'Custom Rig',
      }}
    />
  </div>
)
NoCrawlerRef.meta = {
  description: 'A crawler with no type reference hides the type label.',
}

export const HighTechLevel: Story = () => (
  <div className="max-w-sm">
    <CrawlerCardPreview
      crawler={{
        ...baseCrawler,
        name: 'Apex Predator',
        tech_level: 5,
        max_sp: 40,
        current_damage: 5,
        crawler_ref: 'leviathan',
      }}
    />
  </div>
)

export const RosterGrid: Story = () => (
  <div className="grid max-w-2xl grid-cols-2 gap-4">
    <CrawlerCardPreview crawler={baseCrawler} />
    <CrawlerCardPreview
      crawler={{
        ...baseCrawler,
        id: 'mock-crawler-2',
        name: 'Dustrunner',
        crawler_ref: 'scout',
        tech_level: 1,
        max_sp: 12,
        current_damage: 2,
      }}
    />
    <CrawlerCardPreview
      crawler={{
        ...baseCrawler,
        id: 'mock-crawler-3',
        name: '',
        crawler_ref: null,
        tech_level: 3,
        max_sp: 30,
        current_damage: 20,
      }}
    />
    <CrawlerCardPreview
      crawler={{
        ...baseCrawler,
        id: 'mock-crawler-4',
        name: 'Apex Predator',
        crawler_ref: 'leviathan',
        tech_level: 5,
        max_sp: 40,
        current_damage: 0,
      }}
    />
  </div>
)
RosterGrid.meta = {
  description:
    'Multiple crawler cards in a 2-column grid layout as they would appear in the roster.',
}
