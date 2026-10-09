# salvageunion-reference

Schema-validated JSON dataset and TypeScript ORM for the **Salvage Union**
tabletop RPG, published by [Leyline Press](https://leyline.press/).

This package is private and workspace-internal: other workspaces in this
monorepo consume it as `workspace:*`, and it is not published to npm.

- **Outside this monorepo:** the same data and JSON Schemas are served publicly
  (CORS-enabled). [salvageunion.io/api](https://salvageunion.io/api/) documents
  the endpoints and [salvageunion.io/llms.txt](https://salvageunion.io/llms.txt)
  indexes them.
- **Working on the package:** [`CLAUDE.md`](CLAUDE.md) covers the generated
  files, the public barrels, entity lookup, adding data and schemas, and
  validation.

## License

Salvage Union Open Game Licence 1.0b — see [`LICENCE`](LICENCE).

## Credits

This data was originally copied from [wfreinhart/salvage-union-tracker](https://github.com/wfreinhart/salvage-union-tracker) and later forked from [sbergot/salvageunion-data](https://github.com/sbergot/salvageunion-data).

Salvage Union is copyrighted by Leyline Press. Salvage Union and the "Powered by Salvage" logo are used with permission of Leyline Press, under the Salvage Union Open Game Licence 1.0b.
