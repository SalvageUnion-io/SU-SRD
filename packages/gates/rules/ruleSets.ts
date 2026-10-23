/**
 * Every rule set `tools/check-rule-sets.ts` runs, in launch order: the one
 * list, read by that runner and by the canon check (`tools/check-canon.ts`),
 * which resolves a law's `<set>/<rule>` gate against it.
 */

import type { RuleSet } from '../lib/ruleEngine'
import { chromeLaws } from './chrome'
import { chromeTokens } from './chromeTokens'
import { classPrefix } from './classPrefix'
import { controlLaws } from './controls'
import { copyTerms } from './copyTerms'
import { designTokens } from './designTokens'
import { entityNesting } from './entityNesting'
import { selectMode } from './selectMode'
import { srdCss } from './srdCss'
import { stylingOwnership } from './stylingOwnership'
import { toneGround } from './toneGround'
import { uiStrings } from './uiStrings'

export const RULE_SETS: readonly RuleSet[] = [
  designTokens,
  chromeTokens,
  stylingOwnership,
  srdCss,
  toneGround,
  classPrefix,
  entityNesting,
  chromeLaws,
  selectMode,
  controlLaws,
  copyTerms,
  uiStrings,
]
