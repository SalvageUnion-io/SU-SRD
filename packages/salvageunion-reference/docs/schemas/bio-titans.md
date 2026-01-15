# bio-titans

Massive bio-engineered titan creatures in Salvage Union

## Metadata

- **Schema ID**: `bio-titans`
- **Schema File**: `schemas/bio-titans.schema.json`
- **Data File**: `data/bio-titans.json`
- **Total Items**: 6

## Fields

| Field             | Type              | Required | Description |
| ----------------- | ----------------- | -------- | ----------- |
| `structurePoints` | `positiveInteger` | ✅       |             |

## Example

```json
{
  "id": "8e5b04e5-9532-48c1-86ae-5960da416ede",
  "source": "Salvage Union Workshop Manual",
  "name": "Scylla",
  "actions": [
    {
      "name": "Scythe Attack",
      "range": ["Close"],
      "damage": {
        "amount": 4,
        "damageType": "SP"
      },
      "traits": [
        {
          "type": "melee"
        },
        {
          "type": "multi-attack",
          "amount": 2
        }
      ],
      "id": "17514a3b-5e67-4381-84e0-f3e6fa1582ec",
      "content": [
        {
          "type": "paragraph",
          "value": "Scylla stabs with its forearms attempting to pierce it's prey."
        }
      ]
    },
    {
      "name": "Tail Sweep",
      "actionType": "Turn",
      "traits": [
        {
          "type": "melee"
        }
      ],
      "id": "286b990c-1a7c-4ec6-94f5-ca9c42dea9e5",
      "content": [
        {
          "type": "paragraph",
          "value": "Scylla makes one giant sweeping attack with their tail. This hits every target within Medium Range, dealing 3 SP damage on a hit. Targets hit are knocked Prone and gain the [[Vulnerable]] Trait."
        }
      ]
    },
    {
      "name": "Climb",
      "actionType": "Passive",
      "id": "98c2a5df-32a4-4160-b51f-a18fc9b14b14",
      "content": [
        {
          "type": "paragraph",
          "value": "Scylla can effortlessly climb over difficult and vertical terrain, rocky surfaces, and other obstacles."
        }
      ]
    },
    {
      "name": "Armour Plating",
      "actionType": "Passive",
      "traits": [
        {
          "type": "uses",
          "amount": 3
        }
      ],
      "id": "6b38d373-9d8a-48ea-8276-b27e5f9c7ff1",
      "content": [
        {
          "type": "paragraph",
          "value": "When Scylla takes damage, instead destroy a layer of Armour Plating and negate all of the damage and any effects."
        }
      ]
    },
    {
      "name": "Ambush Predator",
      "actionType": "Passive",
      "id": "d2b78279-f072-4bef-8d11-e91a519412cd",
      "content": [
        {
          "type": "paragraph",
          "value": "Unless detected, Scylla always acts first in combat."
        }
      ]
    },
    {
      "name": "Titanic Actions",
      "id": "8f24fa54-bbfa-4330-be66-f383342068b7",
      "content": [
        {
          "type": "paragraph",
          "value": "Scylla can take three Titanic Actions, choosing from the options below. Only one Titanic Action may be chosen at a time and only at the end of another Pilot's or NPC's turn. Scylla regains spent Titanic Actions at the start of their turn."
        },
        {
          "type": "list-item",
          "value": "Scylla moves one Range Band."
        },
        {
          "type": "list-item",
          "value": "Scylla makes a single Scythe Attack. This does not have the [[Multi-Attack]] Trait."
        },
        {
          "type": "list-item",
          "value": "Scylla makes a Tail Sweep Attack (Costs 2 Titanic Actions)."
        }
      ]
    }
  ],
  "structurePoints": 39,
  "asset_url": "https://opxrguskxuogghzcnppk.supabase.co/storage/v1/object/public/LP-Assets/bio-titans/scylla.jpg",
  "page": 276,
  "content": [
    {
      "type": "paragraph",
      "value": "A gigantic, armoured, arachnid-like predator beast. It has no concept that the war it was designed to fight ended aeons ago, and continues to tear apart anything that enters into its mountainous domain."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
- `shared/objects.schema.json#/definitions/combatEntity`
