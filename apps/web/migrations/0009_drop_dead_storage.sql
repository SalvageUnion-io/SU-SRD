-- contract: no deployed Worker reads or writes either. `shared_meta` held the
-- Convex cutover flag, retired with Convex in 4.5; `accounts.display_name`
-- was never written (0007 says so), and sign-in reads `accounts` by named
-- columns or `accounts.*` without it.
drop table if exists shared_meta;
alter table accounts drop column display_name;
