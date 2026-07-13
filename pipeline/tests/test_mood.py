"""
Tests for the Mood gauge (Part 6.5, ruling C8).

The gauge is the one number on this board that nobody else publishes — we compute it. That is
precisely why it is the most heavily tested: a borrowed number can be checked against its source,
and a home-built one can only be checked against its own definition.
"""

import polars as pl
import pytest

import mood


def _component(key: str, percentile: float) -> mood.Component:
    return mood.Component(key=key, label=key.title(), value=1.0, window="test", percentile=percentile)


# ── percentiles: where a value sits in its own year ───────────────────────────────────────────

def test_a_value_at_the_top_of_its_history_scores_near_one():
    history = list(range(100))  # 0..99
    assert mood.percentile_of(99, history) == pytest.approx(1.0)


def test_a_value_at_the_bottom_of_its_history_scores_near_zero():
    history = list(range(100))
    assert mood.percentile_of(0, history) == pytest.approx(0.01)


def test_the_inverted_components_are_flipped_so_that_higher_always_means_greedier():
    """
    A HIGH VIX is FEAR. A WIDE credit spread is FEAR. Both run backwards against the other three, so
    both are inverted on the way in.

    This is what makes an unweighted mean defensible at all: after inversion every component means
    the same thing in the same direction on the same scale. Average them without this and you are
    adding fear to greed and calling the result a mood.
    """
    calm_year = [float(v) for v in range(10, 40)] * 4     # a VIX history from 10 to 39
    frightening_vix = 38.0

    raw = mood.percentile_of(frightening_vix, calm_year)
    inverted = mood.percentile_of(frightening_vix, calm_year, invert=True)

    assert raw > 0.9           # a high VIX sits high in its own history...
    assert inverted < 0.1      # ...and that is a FEARFUL reading, so the gauge sees it low
    assert inverted == pytest.approx(1.0 - raw)


def test_a_history_too_thin_to_score_returns_nothing_rather_than_a_number():
    """A percentile against six observations is an anecdote with a decimal point."""
    assert mood.percentile_of(5.0, [1.0, 2.0, 3.0]) is None


def test_only_the_trailing_year_counts():
    """
    The window is 252 sessions. A value that would be extreme against a decade can be perfectly
    ordinary against the year it actually sits in, and it is the year the reader is living in.
    """
    ancient_highs = [1000.0] * 500          # a long-ago era of much higher readings
    recent_year = [10.0] * mood.LOOKBACK    # the trailing 252, all low
    history = ancient_highs + recent_year

    # Against the full history 20 is tiny; against the trailing year it is above everything.
    assert mood.percentile_of(20.0, history) == pytest.approx(1.0)


# ── the score, the bands, and the suppression rule ────────────────────────────────────────────

def test_the_score_is_the_unweighted_mean_of_the_component_percentiles():
    """
    The seeded night, worked by hand: (0.55 + 0.38 + 0.48 + 0.35 + 0.34) / 5 = 0.42 → 42.

    A weight is an opinion, and an opinion is the thing this number is trying not to have.
    """
    components = [
        _component("breadth", 0.55),
        _component("volatility", 0.38),
        _component("momentum", 0.48),
        _component("range", 0.35),
        _component("credit", 0.34),
    ]

    gauge = mood.compute(components)

    assert gauge.score == 42
    assert gauge.band == "leaning fearful"
    assert len(gauge.components) == 5


def test_the_arrow_is_derived_from_the_percentile_and_cannot_disagree_with_it():
    """
    THE C6 PRINCIPLE, APPLIED INSIDE THE GAUGE.

    A component's arrow says which way it is pulling the score. Neutral is a component sitting at
    its OWN median, so above the 50th percentile it pulls toward greed and below it toward fear.

    That arrow is a DERIVED property, not a stored field — and the difference is not academic. The
    N0 seed stored an arrow beside each percentile, and one of them had already drifted: momentum
    sat at the 48th percentile, below its own median, and was labelled "greedy". A label free to
    disagree with the data beneath it always eventually does.
    """
    assert _component("momentum", 0.48).contributes == "fearful"
    assert _component("breadth", 0.55).contributes == "greedy"
    assert _component("neutral", 0.50).contributes == "greedy"   # the median itself: not yet fear


@pytest.mark.parametrize(
    "score,word",
    [
        (0, "fearful"), (24, "fearful"),
        (25, "leaning fearful"), (44, "leaning fearful"),
        (45, "mixed"), (55, "mixed"),
        (56, "leaning greedy"), (75, "leaning greedy"),
        (76, "greedy"), (100, "greedy"),
    ],
)
def test_the_band_words_at_every_boundary(score, word):
    """The words are flat by design. There is no "extreme" band, because "extreme greed" is a phrase
    that manufactures urgency, and urgency is the one thing this product refuses to sell."""
    assert mood.band_for(score) == word


def test_fewer_than_three_components_suppresses_the_score_entirely():
    """
    A "market mood" computed from two inputs is not a mood — it is those two inputs wearing a
    costume. When most of the instruments are down, the honest answer is to say so and name them,
    not to average what is left into a confident-looking number. Same instinct as the base rates'
    N-gate.
    """
    assert mood.compute([_component("breadth", 0.6), _component("credit", 0.4)]) is None
    assert mood.compute([]) is None


def test_three_components_is_enough():
    gauge = mood.compute([_component("a", 0.6), _component("b", 0.4), _component("c", 0.5)])
    assert gauge is not None
    assert gauge.score == 50


def test_the_same_inputs_always_produce_the_same_score():
    """Determinism. A gauge that wobbled between runs on identical inputs would be unfalsifiable —
    and a number nobody can check is exactly what we refused to borrow from CNN."""
    components = [_component("a", 0.61), _component("b", 0.37), _component("c", 0.492)]

    scores = {mood.compute(components).score for _ in range(20)}

    assert scores == {49}   # (0.61 + 0.37 + 0.492) / 3 = 0.4907 → 49


# ── the market-side components, from the night's own indicator frame ──────────────────────────


def _bars(rows: list[tuple]) -> pl.DataFrame:
    return pl.DataFrame(rows, schema=["symbol", "date", "close", "sma50"], orient="row")


def test_breadth_is_the_share_of_the_universe_above_its_fifty_day_average():
    from datetime import date

    frame = _bars([
        ("A", date(2026, 7, 9), 110.0, 100.0),   # above
        ("B", date(2026, 7, 9), 90.0, 100.0),    # below
        ("C", date(2026, 7, 9), 105.0, 100.0),   # above
        ("D", date(2026, 7, 9), 99.0, None),     # no average yet — excluded, not counted as "below"
    ])

    series = mood.breadth_series(frame)

    assert series["value"].to_list() == [pytest.approx(2 / 3)]


def test_momentum_measures_the_index_against_its_own_125_session_mean():
    """A flat market sits exactly on its own mean: momentum zero. Nothing clever, but it is the
    anchor the percentile is taken against, so it had better be right."""
    flat = [100.0] * 130

    values = mood.momentum_series(flat)

    assert len(values) == 130 - mood.MOMENTUM_WINDOW + 1
    assert values[-1] == pytest.approx(0.0)


def test_momentum_needs_its_full_window_before_it_says_anything():
    """The first 125 sessions buy no momentum value at all — which is why the FRED history read asks
    for 600 rows and not 252."""
    assert mood.momentum_series([100.0] * 124) == []


def test_a_rising_index_shows_positive_momentum():
    rising = [float(100 + i) for i in range(200)]

    assert mood.momentum_series(rising)[-1] > 0


def _year_of_closes(symbol: str, closes: list[float]) -> list[tuple]:
    """One symbol's bars, one per session, oldest first — enough of them to fill the 252 window."""
    from datetime import date, timedelta

    start = date(2025, 1, 2)
    return [(symbol, start + timedelta(days=i), close, None) for i, close in enumerate(closes)]


def test_range_position_is_the_share_near_highs_minus_the_share_near_lows():
    """
    The component that can see what price alone cannot: a tape held up by a few names while
    everything else sits on its lows.

    Here HIGH ends its year at the top of its own range, LOW ends at the bottom, and MID sits
    halfway. So a third of the universe is near its high, a third near its low, and the reading is
    zero — a market that is going nowhere in particular, which is exactly what these bars describe.
    """
    rising = [float(100 + i) for i in range(mood.LOOKBACK)]        # ends AT its 252-day high
    falling = [float(400 - i) for i in range(mood.LOOKBACK)]       # ends AT its 252-day low
    # A sawtooth that finishes in the middle of its own range — near neither extreme.
    middling = [200.0 + (50.0 if i % 2 else -50.0) for i in range(mood.LOOKBACK - 1)] + [200.0]

    frame = pl.DataFrame(
        _year_of_closes("HIGH", rising) + _year_of_closes("LOW", falling) + _year_of_closes("MID", middling),
        schema=["symbol", "date", "close", "sma50"],
        orient="row",
    )

    latest = mood.range_position_series(frame).sort("date")["value"].to_list()[-1]

    assert latest == pytest.approx(1 / 3 - 1 / 3)


def test_range_position_ignores_symbols_without_a_full_year_of_history():
    """
    A stock that listed six weeks ago has no 252-day high to be near, and a newly-listed name
    counted as "not near its high" would drag the reading down for a reason that has nothing to do
    with how the market feels. It is excluded until it has a year to be measured against.
    """
    rising = [float(100 + i) for i in range(mood.LOOKBACK)]
    newcomer = [float(50 + i) for i in range(30)]

    frame = pl.DataFrame(
        _year_of_closes("OLD", rising) + _year_of_closes("NEW", newcomer),
        schema=["symbol", "date", "close", "sma50"],
        orient="row",
    )

    series = mood.range_position_series(frame).sort("date")
    latest = series["value"].to_list()[-1]

    assert latest == pytest.approx(1.0)   # OLD is at its high and is the only name that qualifies
