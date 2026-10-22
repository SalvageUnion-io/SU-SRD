import { createFileRoute } from '@tanstack/react-router'
import { MetricsScreen } from '../../build/account/MetricsScreen'
import { pageTitle } from '../../lib/pageTitle'

export const Route = createFileRoute('/admin/metrics')({
  head: () => ({ meta: [{ title: pageTitle('Metrics') }] }),
  component: MetricsScreen,
})
