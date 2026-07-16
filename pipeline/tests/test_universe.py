"""
Tests for universe.classify_asset_class — the coarse class the Movers liquid floor reads (CC6).

The class is name-derived because Alpaca gives no security-type field. The floor keeps a name only if
it is a "stock" or one of the CORE_SERVED funds, so the one thing that MUST be right is: a real common
stock is never mis-called a fund, and an ETF/ETN never passes as a stock.
"""

from universe import CORE_SERVED, classify_asset_class


def test_a_common_stock_is_a_stock():
    assert classify_asset_class("Apple Inc.") == "stock"
    assert classify_asset_class("JPMorgan Chase & Co.") == "stock"
    assert classify_asset_class("Exxon Mobil Corporation") == "stock"


def test_an_etf_or_etn_is_a_fund():
    assert classify_asset_class("SPDR S&P 500 ETF Trust") == "fund"
    assert classify_asset_class("Invesco QQQ Trust ETF") == "fund"
    assert classify_asset_class("iPath Series B S&P 500 VIX ETN") == "fund"
    assert classify_asset_class("Vanguard Total Stock Market Fund") == "fund"
    # The obscure ETF from the D6 junk parade — a fund, so the floor drops it (it is not core).
    assert classify_asset_class("EA Series Trust Honeytree U.S. Equity ETF") == "fund"


def test_trust_alone_is_not_a_fund_marker_because_common_stocks_carry_it():
    """Northern Trust is a bank, not a fund. 'Trust' is too common in real company names to be a
    marker; the illiquid trusts that slip through fall out on the dollar-volume floor instead."""
    assert classify_asset_class("Northern Trust Corporation") == "stock"
    assert classify_asset_class("Structured Products CorTS PECO Energy Cap Trust III, 8% Cert.") == "stock"


def test_the_core_funds_are_the_only_funds_the_floor_keeps():
    """Every CORE_SERVED symbol is a fund by name-or-whitelist; the loader's floor rescues exactly
    these fifteen and no other fund."""
    assert CORE_SERVED[0] == "SPY"
    assert len(CORE_SERVED) == 15
    assert set(CORE_SERVED) == {
        "SPY", "QQQ", "DIA", "IWM",
        "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC",
    }
