-- Every shared row names a person by their Discord id, as the rooms and the
-- cutover's bundles do; `accounts.account_id` stays sign-in's own id.
alter table memberships rename column account_id to discord_id;
alter table account_totals rename column account_id to discord_id;
drop index memberships_by_account;
create index memberships_by_discord_id on memberships (discord_id);
