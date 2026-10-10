import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { NpcDesignerPage } from '../../components/npc/NpcDesignerPage'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import { pageTitle } from '../../lib/pageTitle'

/**
 * `/npcs/new` — the NPC designer (issue 1277, board N1). Always the guided
 * designer: an NPC has no Blank door (D4).
 */
export const Route = createFileRoute('/npcs/new')({
  head: () => ({ meta: [{ title: pageTitle('Design an NPC') }] }),
  component: NpcsNewPage,
})

function NpcsNewPage() {
  const navigate = useNavigate()

  return (
    <NewEntityScreen
      kind="npc"
      mode="guided"
      wizard={
        <NpcDesignerPage
          onCreated={(id) => void navigate({ to: '/sheet/$kind/$id', params: { kind: 'npc', id } })}
          onCancel={() => void navigate({ to: '/' })}
        />
      }
      onModeChange={() => undefined}
      onCreated={(id) => void navigate({ to: '/sheet/$kind/$id', params: { kind: 'npc', id } })}
    />
  )
}
