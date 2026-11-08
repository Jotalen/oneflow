/**
 * Tiger Data schema (TimescaleDB). Applied by `pnpm tiger:setup`; every statement is idempotent.
 * Statements run one by one: a continuous aggregate cannot be created inside a transaction.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS nessie_events (
     seq             bigint      NOT NULL,
     created_at      timestamptz NOT NULL,
     type            text        NOT NULL,
     account_id      text,
     tx_id           text,
     persona_id      text,
     kind            text,
     status          text,
     amount_cents    bigint,
     balance_cents   bigint,
     delta_cents     bigint,
     decision        text,
     decision_source text,
     PRIMARY KEY (seq, created_at)
   )`,
  `SELECT create_hypertable('nessie_events', by_range('created_at', INTERVAL '1 day'), if_not_exists => TRUE)`,
  `CREATE INDEX IF NOT EXISTS nessie_events_persona_time ON nessie_events (persona_id, created_at DESC)`,
  `CREATE MATERIALIZED VIEW IF NOT EXISTS account_balance_15m
     WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
   SELECT time_bucket(INTERVAL '15 minutes', created_at) AS bucket,
          persona_id,
          account_id,
          last(balance_cents, created_at) AS balance_cents,
          count(*) AS changes
     FROM nessie_events
    WHERE type = 'account.balance_changed' AND balance_cents IS NOT NULL
    GROUP BY bucket, persona_id, account_id
   WITH NO DATA`,
  `SELECT add_continuous_aggregate_policy('account_balance_15m',
     start_offset => INTERVAL '30 days', end_offset => INTERVAL '15 minutes',
     schedule_interval => INTERVAL '5 minutes', if_not_exists => TRUE)`,
];
