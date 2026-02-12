import { usePilotRoster } from '../../hooks/usePilot'
import { useUserMechs } from '../../hooks/useMech'
import { useUserCrawlers } from '../../hooks/useCrawler'
import { useAuthStore } from '../../stores/authStore'
import { PilotCard } from './PilotCard'
import { MechCard } from './MechCard'
import { CrawlerCard } from './CrawlerCard'
import { CreatePilotDialog } from './CreatePilotDialog'
import { CreateMechDialog } from './CreateMechDialog'
import { CreateCrawlerDialog } from './CreateCrawlerDialog'
import { LogOut } from 'lucide-react'

export function RosterView() {
  const { user, signOut } = useAuthStore()
  const { data: pilots, isLoading: pilotsLoading } = usePilotRoster()
  const { data: mechs, isLoading: mechsLoading } = useUserMechs()
  const { data: crawlers, isLoading: crawlersLoading } = useUserCrawlers()

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pilot">In The Union Now</h1>
          <p className="text-xs text-su-grey-dark">{user?.email ?? 'Pilot'}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-su-grey-dark transition-colors hover:bg-su-grey-light/20"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      {/* Pilots section */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-pilot">Pilots</h2>
        {pilotsLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-[160px] animate-pulse rounded-xl bg-su-grey-light/20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pilots?.map((pilot) => (
              <PilotCard key={pilot.id} pilot={pilot} />
            ))}
            <CreatePilotDialog />
          </div>
        )}
      </section>

      {/* Mechs section */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-mech">Mechs</h2>
        {mechsLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-[120px] animate-pulse rounded-xl bg-su-grey-light/20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mechs?.map((mech) => (
              <MechCard key={mech.id} mech={mech} />
            ))}
            <CreateMechDialog />
          </div>
        )}
      </section>

      {/* Crawlers section */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-crawler">Crawlers</h2>
        {crawlersLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="h-[100px] animate-pulse rounded-xl bg-su-grey-light/20" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {crawlers?.map((crawler) => (
              <CrawlerCard key={crawler.id} crawler={crawler} />
            ))}
            <CreateCrawlerDialog />
          </div>
        )}
      </section>
    </div>
  )
}
