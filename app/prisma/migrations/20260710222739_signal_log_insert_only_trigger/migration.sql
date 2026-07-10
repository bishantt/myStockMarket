-- signal_log is INSERT-ONLY (plan §1.5 rule 7). The earlier REVOKE is defence-in-depth but does
-- not stop the table OWNER, which is the role the app connects as on Supabase. A trigger that
-- raises on UPDATE or DELETE blocks the operation for everyone, owner included — so the public
-- track record can never be rewritten and every miss stays visible forever.
CREATE OR REPLACE FUNCTION signal_log_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'signal_log is insert-only (plan rule 7): % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signal_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "signal_log"
  FOR EACH ROW EXECUTE FUNCTION signal_log_block_mutation();
