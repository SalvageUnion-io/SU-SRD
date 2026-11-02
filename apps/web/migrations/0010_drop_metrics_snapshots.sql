-- contract: no deployed Worker reads or writes it. Signals metrics are
-- computed live from the database on each read, so the daily snapshot
-- and its cron are gone (ADR-057).
drop table if exists metrics_snapshots;
