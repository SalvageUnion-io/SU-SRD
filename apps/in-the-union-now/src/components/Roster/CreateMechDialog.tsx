import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronDown, Plus, X } from 'lucide-react'
import { useCreateMech } from '../../hooks/useMech'
import { useNavigate } from '@tanstack/react-router'
import { cn } from 'suref-react'
import { SalvageUnionReference } from 'salvageunion-reference'

type TechLevelFilter = 'all' | '1' | '2' | '3' | '4' | '5' | '6' | 'B' | 'N'

const TECH_LEVEL_LABELS: Record<TechLevelFilter, string> = {
  all: 'All Tech Levels',
  '1': 'Tech Level 1',
  '2': 'Tech Level 2',
  '3': 'Tech Level 3',
  '4': 'Tech Level 4',
  '5': 'Tech Level 5',
  '6': 'Tech Level 6',
  B: 'Bio',
  N: 'Nanite',
}

export function CreateMechDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [chassisRef, setChassisRef] = useState<string | null>(null)
  const [techFilter, setTechFilter] = useState<TechLevelFilter>('all')
  const createMech = useCreateMech()
  const navigate = useNavigate()

  const chassisList = SalvageUnionReference.Chassis.all()

  const availableTechLevels = useMemo(() => {
    const levels = new Set<string>()
    for (const chassis of chassisList) {
      levels.add(String(chassis.techLevel))
    }
    return levels
  }, [chassisList])

  const filteredChassis = useMemo(
    () =>
      techFilter === 'all'
        ? chassisList
        : chassisList.filter((c) => String(c.techLevel) === techFilter),
    [chassisList, techFilter]
  )

  const handleCreate = async () => {
    if (!name.trim()) return

    const mech = await createMech.mutateAsync({
      name: name.trim(),
      chassis_ref: chassisRef,
    })

    setOpen(false)
    setName('')
    setChassisRef(null)
    setTechFilter('all')
    navigate({ to: '/mech/$id', params: { id: mech.id } })
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex h-full min-h-[120px] items-center justify-center rounded-xl border-2 border-dashed border-su-grey-light p-4 text-su-grey transition-colors hover:border-mech hover:text-mech">
          <div className="flex flex-col items-center gap-2">
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">New Mech</span>
          </div>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[var(--background)] p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold">New Mech</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 hover:bg-su-grey-light/20">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="mech-name">
                Name
              </label>
              <input
                id="mech-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter mech name..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mech"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">Chassis</label>
                <div className="relative">
                  <select
                    value={techFilter}
                    onChange={(e) => {
                      setTechFilter(e.target.value as TechLevelFilter)
                      setChassisRef(null)
                    }}
                    className="appearance-none rounded-md border border-[var(--border)] bg-[var(--input)] py-1 pl-2 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-mech"
                  >
                    {(Object.keys(TECH_LEVEL_LABELS) as TechLevelFilter[])
                      .filter((key) => key === 'all' || availableTechLevels.has(key))
                      .map((key) => (
                        <option key={key} value={key}>
                          {TECH_LEVEL_LABELS[key]}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-su-grey" />
                </div>
              </div>
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
                {filteredChassis.map((chassis) => (
                  <button
                    key={chassis.id}
                    onClick={() => setChassisRef(chassisRef === chassis.id ? null : chassis.id)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      chassisRef === chassis.id
                        ? 'border-mech bg-mech/10 font-medium'
                        : 'border-[var(--border)] hover:border-mech/50'
                    )}
                  >
                    {chassis.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!name.trim() || createMech.isPending}
              className="w-full rounded-lg bg-mech px-4 py-2 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {createMech.isPending ? 'Creating...' : 'Create Mech'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
