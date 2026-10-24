import { GlobalRegistrator } from '@happy-dom/global-registrator'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
  var BASE_UI_ANIMATIONS_DISABLED: boolean
}

GlobalRegistrator.register()

// Tell React we're in a testing environment to enable act() warnings
// This is the standard way to configure React's testing behavior
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// happy-dom past 20.11 implements `Element.getAnimations()`, so Base UI waits a
// microtask (or forever, for a dialog's exit) before unmounting a closed part.
// Base UI's own switch makes it unmount at once, as it does without the API.
globalThis.BASE_UI_ANIMATIONS_DISABLED = true
