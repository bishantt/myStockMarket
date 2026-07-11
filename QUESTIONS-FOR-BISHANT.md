# Questions & heads-ups for Bishan

Things I decided myself and kept going on are in DECISIONS.md. This file holds items I want
your eyes on: genuine questions, and judgment calls where you might want to veto. Nothing here
is blocking my work right now.

Format: newest first. I mark each as [FYI], [VETO?], or [NEED] so you can scan.

---

## 2026-07-10

- **[RESOLVED 2026-07-11] LCP budget miss at phase-0.** You accepted it for P0 and asked me to
  "make it a real gate at P1." Done: the LCP ≤ 2.5s budget is now a HARD gate at the P1 exit —
  `scripts/lighthouse-check.mjs` already exits non-zero on an LCP miss, and P1 will not be tagged
  until LCP passes for real (P1 adds real content, so the measurement becomes meaningful and the
  actual LCP element can be optimised). Recorded in DECISIONS.md (2026-07-11).
  <details><summary>original [VETO?] context</summary>
  Every real budget passed at phase-0 (perf 90-95, a11y 100, CLS 0, JS 131KB, 12-17ms server);
  only LCP (2.8-3.4s, run-to-run variance) missed, as a synthetic cold-4G artifact on a
  contentless page — the app was already optimally built. You accepted this for P0.</details>

- **[FYI] Optional cleanups, whenever you like (none blocking):**
  - Rotate the Supabase DB password (it appeared in our chat early on). Vercel + GitHub already
    have everything, so it is a quick re-paste and one re-test.
  - Delete the unused "My First Check" in healthchecks.io.
  - Connect the GitHub repo in Vercel (Project → Settings → Git, Root Directory = `app`) so
    `git push` auto-deploys. Right now I deploy via the CLI.
  - If you want me to run the healthchecks drill or Lighthouse locally in future, add
    HEALTHCHECKS_PING_URL + HEALTHCHECKS_API_KEY to the repo-root `.env` (Appendix D lists the
    API key as local too). For now I run those through GitHub Actions where the secrets live.
