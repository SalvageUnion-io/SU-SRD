import type { ParentType } from '../types/common'

export const pilotKeys = {
  all: ['pilots'] as const,
  roster: ['pilots', 'roster'] as const,
  byId: (id: string) => ['pilots', id] as const,
}

export const mechKeys = {
  all: ['mechs'] as const,
  byId: (id: string) => ['mechs', id] as const,
  byPilot: (pilotId: string) => ['mechs', 'byPilot', pilotId] as const,
  userMechs: ['mechs', 'user'] as const,
}

export const crawlerKeys = {
  all: ['crawlers'] as const,
  byId: (id: string) => ['crawlers', id] as const,
  userCrawlers: ['crawlers', 'user'] as const,
}

export const entityRefKeys = {
  all: ['entityRefs'] as const,
  byParent: (parentType: ParentType, parentId: string) =>
    ['entityRefs', parentType, parentId] as const,
}

export const choiceKeys = {
  all: ['choices'] as const,
  byEntityRef: (entityRefId: string) => ['choices', entityRefId] as const,
}

export const cargoKeys = {
  all: ['cargo'] as const,
  byParent: (parentType: ParentType, parentId: string) => ['cargo', parentType, parentId] as const,
}
