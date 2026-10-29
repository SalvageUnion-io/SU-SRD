import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { MetricsScreen } from '../../build/account/MetricsScreen'
import { areaTitle } from '../../lib/pageTitle'
import { routesCopy } from '../../messages/routes'

export const Route = createFileRoute('/admin/metrics')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, routesCopy('metrics')) }] }),
  component: MetricsScreen,
})
