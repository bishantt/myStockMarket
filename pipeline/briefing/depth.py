"""
depth.py — the depth engine (POLISH-AND-DEPTH-PLAN Part 9.2).

Part 9's thesis is that depth arrives in TWO MOVES and the pipeline goes first: the LLM narrates
only what the pipeline computed, so the narrator's vocabulary can only grow by growing the registry.
This module computes the new words. `stats.py` renders them into the quotable table, and
`verify.py`'s gate then checks the prose back against that same table.

Everything here is a PURE FUNCTION over a list of bars. No database, no clock, no provider — which
is what makes the whole set fixture-testable (known bars in, known value out), and that is the only
reason these numbers can be trusted enough to be the gate's own source of truth.

TWO RULES GOVERN EVERY FUNCTION IN THIS FILE, and they are the same rule twice:

  1. **A window that is not full yields None.** A "52-week range" computed over 200 sessions is not
     a 52-week range; a "50-day average" over 30 bars is not a 50-day average. The honest answer to
     "where does this name sit in its year?" for a stock that has only traded four months is that
     the question has no answer yet, not a number computed over whatever happened to be there.

  2. **Absence over invention.** A measure the data cannot support is ABSENT — never a zero, never a
     default, never a fallback to a shorter window. This is not fastidiousness. The registry is what
     the deterministic gate checks prose against, so a number the registry invents is a number the
     gate will CERTIFY. A fabrication the pipeline mints itself is the one kind no gate can catch.

The cost of both rules is that the narrator sometimes has less to say about a name. That is the
intended failure mode: honest degradation, zero new ways to be wrong.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable, Mapping, Sequence

# The trailing windows, named. 252 sessions is the market's year (roughly 52 weeks of trading days);
# 50 is the moving average the scans and the Desk already speak in, so the story page and the scan
# room cannot end up quoting two different "50-day averages".
WINDOW_52W = 252
WINDOW_50D = 50


@dataclass(frozen=True)
class Bar:
    """One daily bar, in the only four fields this module reads."""

    date: date
    high: float
    low: float
    close: float


@dataclass(frozen=True)
class Position52w:
    """Where tonight's close sits between the year's low and its high. THREE numbers, one stat —
    a bare "63%" is not checkable by a reader, and the low and the high are what make it so."""

    pct: float    # 0–100, the percent of the way from the low to the high
    low: float
    high: float


@dataclass(frozen=True)
class Streak:
    """Consecutive same-direction sessions through tonight. `direction` is "up" or "down"; the
    LENGTH is the number, and the direction rides the label — the same split the movers use, and for
    the same reason (the gate checks numbers, not direction words)."""

    length: int
    direction: str


@dataclass(frozen=True)
class CalendarRef:
    """One already-scheduled, dated event the narrator may point at — and may ONLY point at.

    E4: the watch section states CALENDAR FACTS. The narrator SELECTS from the rows it was shown; it
    can never author one, and it can never turn one into a threshold to act on. That rule is kept
    structurally rather than by asking nicely: `watch` is a list of these ids, every id must resolve
    back to a row the narrator was actually handed, and a ref that resolves to nothing is dropped.

    `key` is the symbol for a company event, or the macro code (CPI, FOMC) for a market-wide one —
    the two kinds of thing a story can be exposed to.
    """

    stat_id: str
    key: str
    code: str | None
    kind: str
    title: str
    date: date

    def to_json(self) -> dict:
        """The SNAPSHOT the cluster stores. Rows, not bare refs — the same argument as the articles
        snapshot and catalyst_link's numbers: a story page that re-resolved a ref against a live
        calendar could disagree with the feed about what is scheduled, and the same fact with two
        values is precisely the species of lie this app exists not to tell."""
        return {
            "stat_id": self.stat_id,
            "key": self.key,
            "code": self.code,
            "kind": self.kind,
            "title": self.title,
            "date": self.date.isoformat(),
        }


def build_calendar_refs(rows: Iterable[Mapping[str, object]]) -> list[CalendarRef]:
    """The NEXT scheduled event per key, from calendar rows the reader has already filtered to the
    horizon and sorted by date. One ref per key: a reader wants to know what is coming for this name,
    not the whole diary, and the watch section shows at most two entries anyway.

    A row with neither a symbol nor a code has no key, so it cannot be pointed at, so it is skipped —
    a calendar entry nobody can name is not a fact a story can carry.
    """
    refs: dict[str, CalendarRef] = {}
    for row in rows:
        symbol = row.get("symbol")
        code = row.get("code")
        key = str(symbol) if symbol else (str(code) if code else None)
        if key is None or key in refs:
            continue  # first wins — the caller sorted by date, so the first is the NEXT one
        event_date = row.get("date")
        if not isinstance(event_date, date):
            continue
        refs[key] = CalendarRef(
            stat_id=f"cal:{key}:next",
            key=key,
            code=str(code) if code else None,
            kind=str(row.get("kind") or "event"),
            title=str(row.get("title") or "Scheduled event"),
            date=event_date,
        )
    return list(refs.values())


@dataclass(frozen=True)
class TickerDepth:
    """Everything the registry can say about one name tonight. Every field is optional, and a name
    the lake does not carry produces one of these with every field None — see `any_measure`."""

    symbol: str
    pos52w: Position52w | None = None
    move_atr: float | None = None   # tonight's move in units of the name's OWN ATR14, unsigned
    streak: Streak | None = None
    from50d: float | None = None    # signed percent distance from the 50-day average

    def any_measure(self) -> bool:
        """True if this name has anything quotable at all. The caller uses it to skip a symbol
        entirely rather than emit an empty stat block the narrator would have to reason about."""
        return any(
            value is not None
            for value in (self.pos52w, self.move_atr, self.streak, self.from50d)
        )


def build_ticker_depth(
    symbol: str,
    bars: Sequence[Bar],
    *,
    ret1: float | None,
    atr14_pct: float | None,
) -> TickerDepth:
    """Assemble every measure the bars support for one name.

    `ret1` (tonight's fractional return) and `atr14_pct` (ATR14 as a fraction of price) come from
    the scan metrics the night has ALREADY computed — they are not recomputed here, because two
    independent calculations of "today's move" is exactly how the feed's number and the story page's
    number come to disagree by a basis point and make a liar of both.
    """
    return TickerDepth(
        symbol=symbol,
        pos52w=position_in_52w_range(bars),
        move_atr=move_in_atr_units(ret1, atr14_pct),
        streak=consecutive_streak(bars),
        from50d=distance_from_50d(bars),
    )


def position_in_52w_range(bars: Sequence[Bar], window: int = WINDOW_52W) -> Position52w | None:
    """Where the last close sits between the trailing year's low and high, as a percent of the way up.

    The low and high are the extremes of the daily LOW and HIGH — the actual prices the name traded
    at — which is the same convention `indicators.dist_52w_high` uses, so the two cannot disagree.

    A range of zero width returns None. The division is undefined, and choosing 0% or 100% for a
    stock that has not moved all year would be the app answering a question the data cannot.
    """
    if len(bars) < window:
        return None
    recent = bars[-window:]
    low = min(bar.low for bar in recent)
    high = max(bar.high for bar in recent)
    if high <= low:
        return None
    close = recent[-1].close
    return Position52w(pct=(close - low) / (high - low) * 100.0, low=low, high=high)


def move_in_atr_units(ret1: float | None, atr14_pct: float | None) -> float | None:
    """Tonight's move measured in the name's OWN normal daily range — the number `rank.py` already
    computes to score significance, PROMOTED here to a registry stat so prose may cite what the
    ranking uses. An 18% day in a name that routinely swings 6% is a big move, not an extraordinary
    one, and this is the figure that says so.

    UNSIGNED, like the movers: the gate checks numbers and not direction words, so a sentence that
    says a stock "fell 2.3 times its usual range" must match a source of 2.3, not -2.3. Direction is
    carried by the label and by the data.

    UNCAPPED, unlike the ranking. `rank.py` caps at 3 ATRs because past that the score should stop
    rewarding lottery tickets — that is a scoring choice. This is a FACT, and a fact is not capped.
    """
    if ret1 is None or not atr14_pct:
        return None
    return abs(ret1) / atr14_pct


def consecutive_streak(bars: Sequence[Bar]) -> Streak | None:
    """How many sessions in a row this name has closed in the same direction, through tonight.

    An UNCHANGED close breaks the streak and returns None. A flat session is not an up session, and
    counting it as one would quietly inflate every streak on the board by whatever the market did
    nothing on.
    """
    if len(bars) < 2:
        return None

    def step(later: Bar, earlier: Bar) -> int:
        if later.close > earlier.close:
            return 1
        if later.close < earlier.close:
            return -1
        return 0

    last = step(bars[-1], bars[-2])
    if last == 0:
        return None

    length = 1
    for index in range(len(bars) - 2, 0, -1):
        if step(bars[index], bars[index - 1]) != last:
            break
        length += 1

    return Streak(length=length, direction="up" if last > 0 else "down")


def distance_from_50d(bars: Sequence[Bar], window: int = WINDOW_50D) -> float | None:
    """How far tonight's close sits from the trailing 50-day average close, as a signed percent."""
    if len(bars) < window:
        return None
    recent = bars[-window:]
    average = sum(bar.close for bar in recent) / window
    if average == 0:
        return None
    return (recent[-1].close - average) / average * 100.0
