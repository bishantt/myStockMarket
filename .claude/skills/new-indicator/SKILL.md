# new-indicator

**Status:** MINTED at P1 step 3 (2026-07-11), the v1 indicator set. Follow it for every new indicator.

**When to use:** adding any technical indicator to `pipeline/indicators.py`.

## Steps
1. **Write it as a pure Polars expression** in `pipeline/indicators.py` — a function returning a
   `pl.Expr` (or a dict of named exprs for multi-line indicators like MACD/Bollinger) over a
   single symbol's bar frame in date order. No Python row loops: these run over the whole universe
   × years, so it must stay a native expression. Recursive smoothers use `ewm_mean(adjust=False)`;
   rolling windows use `min_samples=length` (Polars ≥1.21 renamed `min_periods`).
2. **Add it to `with_indicators`** with a snake_case column alias.
3. **Test it against the oracle** (pandas-ta-classic) on the frozen toy series
   (`pipeline/tests/toy_series.py`, deterministic, 240 bars):
   - Non-recursive (SMA/Bollinger/returns/gap/RVOL/...): assert EXACT match over the whole valid
     range (rtol 1e-9) and identical null pattern.
   - Recursive (EMA/RSI/ATR/MACD): assert identical null warm-up + a tight match on the converged
     tail (index ≥ ~210, rtol 1e-6). Polars seeds the recursion at the first value, pandas-ta
     SMA-seeds it; they converge — do NOT chase the warm-up seed, document it.
   - No oracle for it (RVOL, 52w-dist)? Test against its own arithmetic definition.
4. **Causality guard (mandatory, §6.2):** appending a later bar must never change an earlier
   value — `with_indicators(bars.head(k))` must equal `with_indicators(bars).head(k)` exactly.
5. Run `uv run pytest tests/test_indicators.py`. All green, warnings clean.

## Verification
- Oracle match (exact or converged) + causality guard both green.
- A new pattern DETECTOR built on the indicator is a separate thing — see new-pattern-detector (P4)
  and its one-bar-shift base-rate guard; that is NOT this skill.

## Worked example — the v1 set (P1 step 3)
SMA 20/50/200, EMA 12/26, RSI 14 (Wilder), MACD 12-26-9, ATR 14, Bollinger 20/2 (population std,
ddof=0), RVOL 20, 52-week-high distance, gap %, returns 1/5/20 — all in indicators.py, 20 tests in
tests/test_indicators.py. EMA SMA-seed matches the oracle to 0.0; RSI/ATR converge.
