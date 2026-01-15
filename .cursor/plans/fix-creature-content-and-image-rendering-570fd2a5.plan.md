<!-- 570fd2a5-7125-4aeb-9660-ce1eb6d2c850 a616351b-52fb-47ec-af43-dd24908a69f1 -->
# Fix Creature Content and Image Rendering

## Problem

Only one creature entity is rendering with description and image content. The issue is in `EntityTopMatter.tsx`:

1. When a creature has a single visible action, the code replaces the creature's `content` with the action's `content`
2. If the action has no content, `contentBlocks` becomes undefined
3. The `hasContent` check doesn't account for image URLs
4. `EntityTopMatter` returns `null`, hiding both content and images

## Solution

Modify `apps/suref-web/src/components/entity/EntityDisplay/EntityTopMatter.tsx`:

1. **Change replacement logic**: Instead of checking for a single action, check if any action name matches the entity name. Only replace entity content if an action name matches the entity name.
2. **Check for images**: Include `getAssetUrl(data)` in the `hasContent` check so images render even without content
3. **Preserve entity content**: If no action name matches entity name, keep entity content and render actions separately via `EntityActions`

## Changes

### File: `apps/suref-web/src/components/entity/EntityDisplay/EntityTopMatter.tsx`

- Import `getAssetUrl` from `salvageunion-reference`
- Replace the single-action check (lines 15-22) with a name-matching check:
- Get entity name from `data.name` or use `extractName(data, schemaName)` from context
- Check if any visible action has a name that matches the entity name
- Only if there's a match, replace entity content with that action's content
- Otherwise, keep the entity's original content
- Update `hasContent` (line 33-34) to include image URL check: `!!getAssetUrl(data)`
- Ensure entity content is always preserved when action names don't match