-- signal_log is INSERT-ONLY (plan §1.5 rule 7, Appendix B "grant-revoked").
-- The public track record must show every miss, permanently — so the app's database role may
-- insert rows but never update or delete them. INSERT stays granted; the pipeline writes with
-- ON CONFLICT DO NOTHING, and nothing in the system can rewrite history.
--
-- On Supabase the `postgres` role is not a superuser, so REVOKE is enforced.
REVOKE UPDATE, DELETE ON "signal_log" FROM PUBLIC;
REVOKE UPDATE, DELETE ON "signal_log" FROM postgres;
