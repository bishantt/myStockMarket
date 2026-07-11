# new-pattern-detector

**Status:** MINTED at P4 step 1 (2026-07-11), the six v1 detectors. Follow it for every new detector.

**When to use:** adding any pattern detector to `pipeline/detectors.py` — a rule that fires on the
bar a pattern completes and whose historical outcomes feed a base rate.

**Not this skill:** a plain technical indicator (a value on every bar) is `new-indicator`. A detector
is a boolean EVENT built on indicators, and it carries the lookahead guards below.

## Steps
1. **Write the fire condition as a Polars expression** over the indicator frame (the columns from
   `with_indicators`). A "cross" compares today to the prior bar with `.shift(1).over("symbol")` —
   NEVER a forward shift. A same-bar threshold (unusual-volume, gap) needs no shift. Add a
   `KEY = "kebab-name"` constant; this key is the pattern_meta key AND the base_rate_stat pattern.
2. **Emit signal_events shape** via the `_events(frame, fired, key, direction, attrs)` helper:
   `symbol · date · pattern_key · direction · attrs(struct)`. Direction is "up"/"down" from the
   pattern's own logic; attrs carries the triggering metric(s) for provenance. A market-level
   detector (breadth) is a separate function over a single series, symbol = "MARKET".
3. **Register it** in `detect()` (per-symbol) so it runs with the others.
4. **Tests first (plan §6.2), one fire test + one shift guard per detector:**
   - **Fire test:** it fires on exactly the bar the pattern completes, and does NOT re-fire while the
     condition merely persists (a cross fires once). Feed controlled indicator columns — do not
     rebuild 200-bar synthetic price paths.
   - **One-bar-shift guard (mandatory):** build two frames identical through bar t that differ only
     at a FUTURE bar; whether bar t fired must be identical in both. If it changes, the detector
     peeked ahead.
5. **The +1 forward-return shift is shared, not per-detector:** `forward_returns` anchors the
   outcome ONE bar after the signal (entry = close[t+1], exit = close[t+1+h]), so a base rate can
   never include the signal bar's own move. Do not re-implement this per detector; a new horizon
   goes through `forward_returns(..., horizons=...)`.
6. Run `uv run pytest tests/test_detectors.py`. All green.

## Verification
- Fire test + shift guard both green for the new detector.
- Guarding well: the shift guard is the honesty check — a detector that fails it would flatter every
  base rate built on it. Commit the RED shift-guard test first when the guard is subtle (plan §6.4).

## Worked example — the v1 six (P4 step 1)
golden-cross · 52w-high-proximity · gap-with-catalyst · rsi-extreme · unusual-volume (per-symbol,
in `detect`) + breadth-regime (market-level, in `detect_breadth`). `detectors.py`, 9 tests in
`tests/test_detectors.py` (fire tests, a combined shift guard over all five per-symbol detectors,
and the +1 forward-return anchor). Thresholds are Appendix F; two keys (unusual-volume, rsi-extreme)
match the P1 scan presets — one definition, two consumers.
