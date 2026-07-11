"""
volbands.py — empirical volatility bands for watchlist symbols (plan P4 step 3, Appendix F).

A vol band is the one forward-looking number the whole app allows itself, and it is deliberately not
a forecast: it is the empirical range of what this symbol's h-day paths have actually done, drawn as
a range with a frequency label and ALWAYS carried with the regime-break caveat in the UI (copy key
`volband.caveat`, §1.5 rule 1). Nothing here reaches beyond 20 trading days — the schema forbids it,
and a property test proves it.

Each band comes from the OVERLAPPING h-day returns over the trailing window (default 500 sessions):
for every start bar t, close[t+h]/close[t] - 1. The empirical quantiles of that distribution give
the band — the 50% band is the p25–p75 range, the 80% band is p10–p90. The band is stored as a
RETURN range (a fraction), anchor-independent; the chart projects it from the current close at render.

A symbol without enough history for even the shortest horizon yields no band — the honest "no range"
rather than a made-up one.
"""

from __future__ import annotations

# The horizons a vol band may span. Nothing beyond 20 days, by schema (Appendix B / §1.5 rule 1).
HORIZONS: tuple[int, ...] = (5, 10, 20)

# The two coverage levels and the quantile pair each uses (Appendix F: 50% = p25–p75, 80% = p10–p90).
_COVERAGE = {
    0.5: (0.25, 0.75),
    0.8: (0.10, 0.90),
}

# The trailing window of sessions the empirical distribution is drawn from (Appendix F: ~500).
_DEFAULT_WINDOW = 500


def compute_vol_bands(symbol: str, closes: list[float], *, window: int = _DEFAULT_WINDOW) -> list[dict]:
    """Compute the vol_band rows for one symbol from its recent closes (oldest first).

    Returns one row per (horizon, coverage) with lo/hi as return fractions, or an empty list when
    there is not enough history to form even the shortest horizon's distribution.
    """
    rows: list[dict] = []
    for horizon in HORIZONS:
        returns = _overlapping_returns(closes, horizon, window)
        if len(returns) < 2:
            continue  # too little history for this horizon — no band, not a guess
        for coverage, (q_lo, q_hi) in _COVERAGE.items():
            lo = _quantile(returns, q_lo)
            hi = _quantile(returns, q_hi)
            rows.append({
                "symbol": symbol,
                "horizonDays": horizon,
                "lo": lo,
                "hi": hi,
                "coverage": coverage,
                "label": _label(coverage, horizon),
            })
    return rows


def _overlapping_returns(closes: list[float], horizon: int, window: int) -> list[float]:
    """Every overlapping h-day return over the trailing `window` START bars.

    A start bar t contributes close[t+h]/close[t] - 1 when t+h exists. Restricting to the last
    `window` start bars keeps the distribution to recent behaviour (the band is not a decade-old view).
    """
    if len(closes) <= horizon:
        return []
    max_start = len(closes) - horizon
    first_start = max(0, max_start - window)
    returns: list[float] = []
    for t in range(first_start, max_start):
        base = closes[t]
        if base > 0:
            returns.append(closes[t + horizon] / base - 1.0)
    return returns


def _quantile(values: list[float], q: float) -> float:
    """A linear-interpolation quantile (the same method numpy/Polars default to), on a copy."""
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = q * (len(ordered) - 1)
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def _label(coverage: float, horizon: int) -> str:
    """A plain frequency label for the band, e.g. "8 in 10 20-day paths". The UI renders it through
    copy.volband.label + the mandatory regime-break caveat; this is the short provenance form."""
    fraction = "5 in 10" if coverage == 0.5 else "8 in 10"
    return f"{fraction} {horizon}-day paths stayed in this range"
