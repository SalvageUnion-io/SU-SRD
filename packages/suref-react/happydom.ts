import { GlobalRegistrator } from '@happy-dom/global-registrator'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

GlobalRegistrator.register()

// Tell React we're in a testing environment to enable act() warnings
globalThis.IS_REACT_ACT_ENVIRONMENT = true
