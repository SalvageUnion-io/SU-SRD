/** The words of apps/web/src/lib/schemas: the message catalogue (ADR-054). */

import { messages } from './define'

export const libSchemasCopy = messages({
  entityDataMissing: 'Entity data is missing or invalid.',
  invalidPilotData: 'Invalid Pilot data: {message}',
  invalidMechData: 'Invalid Mech data: {message}',
  invalidCrawlerData: 'Invalid crawler data: {message}',
  invalidNpcData: 'Invalid NPC data: {message}',
  unknownEntityKind: 'Unknown entity kind: {kind}',
})
