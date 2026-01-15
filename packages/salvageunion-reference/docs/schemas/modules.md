# modules

Mech modules in Salvage Union

## Metadata

- **Schema ID**: `modules`
- **Schema File**: `schemas/modules.schema.json`
- **Data File**: `data/modules.json`
- **Total Items**: 61

## Example

```json
{
  "id": "a7411917-ee9a-48ac-b588-6606e03e58c1",
  "source": "Salvage Union Workshop Manual",
  "name": "Comms Module",
  "techLevel": 1,
  "slotsRequired": 1,
  "salvageValue": 1,
  "recommended": true,
  "page": 190,
  "actions": [
    {
      "id": "4a6d5bbf-5da8-4d66-b1a1-2da9b13be155",
      "traits": [
        {
          "type": "communicator"
        }
      ],
      "actionType": "Free",
      "range": ["Long"],
      "name": "Comms Module",
      "content": [
        {
          "type": "paragraph",
          "value": "This Opus Institute-developed array of telecommunications wires and receivers allows communication with anything with the [[Communicator]] Trait in Range."
        },
        {
          "type": "paragraph",
          "value": "This allows for both voice and text communications via your Mech's HUD. You may also use your Comms Module to send and receive images and data, such as data you gather when using a Scanner. If the Mech does not have a Comms Module or equivalent with the [[Communicator]] Trait you cannot talk to your Allies from their Mech whilst out in the field."
        }
      ]
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/systemModule`
- `shared/objects.schema.json#/definitions/baseEntity`
