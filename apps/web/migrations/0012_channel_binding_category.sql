-- A Game's binding covers the Discord category its channel sits in, and knows
-- its server (ADR-068 §6): the Activity launched from any channel in that
-- category, or the server's only bound Game, opens that Game. Rolls still post
-- to the bound channel. Null on a binding made before, or outside a category.
alter table channel_bindings add column category_id text;
alter table channel_bindings add column guild_id text;
create index channel_bindings_category on channel_bindings (category_id);
create index channel_bindings_guild on channel_bindings (guild_id);
