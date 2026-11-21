/**
 * Withdraw — take back a proposal still awaiting its answer (r2 C7,
 * `ops.withdraw`): a mistyped one no longer waits on the player pressing
 * Decline. Any Mediator's, as the sent list is; a failure is said.
 */

import { useServerAction } from '../../lib/connection/useServerAction'
import { mediatorCopy } from '../../messages/play-mediator'
import { useTableAct } from '../../replica/useTable'

export function useWithdrawProposal(gameId: string): (opId: string) => void {
  const withdraw = useTableAct('ops.withdraw', gameId)
  const action = useServerAction((opId: string) => withdraw({ opId }), {
    failure: mediatorCopy('couldNotWithdraw'),
    toastId: 'proposal-withdraw',
  })
  return (opId) => void action.run(opId)
}
