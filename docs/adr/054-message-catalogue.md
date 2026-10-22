# ADR-054: The Interface's Words Live in One Message Catalogue

Decided and built for 4.1.0: groundwork for a translatable interface, English only.

### 1. One catalogue

Every label, heading, hint and line of chrome the app draws is a key in a
module of `apps/web/src/messages/`, one module per source folder
(`build-sheet.ts` holds `apps/web/src/build/sheet`'s words), each made with
`messages({ … })` from `messages/define.ts`. A component says its words by
key: `buildSheetCopy('payUpkeep')`.

### 2. Values are placeholders, never concatenation

A message carries its values as `{name}` placeholders
(`'Upgrade to Tech {tl}'`) and the call passes them
(`buildSheetCopy('upgradeToTech', { tl })`), so a whole sentence is one
message a translator can reorder. The types refuse an unknown key, a missing
value and a value for a message that takes none. A nullish value says
nothing, as `{value}` in JSX did.

### 3. What is not in it

Rules text and game data are the book's words: they come from
`salvageunion-reference`, are held to the book by the fidelity lock, and stay
English. The Discord bot and Convex error strings are outside this decision.

### 4. Held by a gate

The `ui-strings` rule set (`packages/gates/rules/uiStrings.ts`, run by
`bun run check copy`) ratchets the strings still typed at the call site in
`apps/web/src` (JSX text, word-carrying attributes, prose literals): a new one
fails, and one moved into the catalogue is locked in. It also refuses
`messages(…)` outside the catalogue, a clashing module name, a computed key,
and a key nothing says. The `copy` set reads every catalogue string, one word
or many, so the game-term and spelling rules still see the words.

### 5. Another language

No language but English ships. When one does, it joins at `messages()`: a
locale's module beside each English one, typed by the English keys, chosen
at render. That choice (how the locale is picked, whether modules load
lazily, `<html lang>`) is its own decision, made when a translation exists.
