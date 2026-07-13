"""
resolve.py — which companies is this article actually about? (N4, forced by the recording)

WHY THIS FILE EXISTS AT ALL. The plan assumed the providers tag their articles with the tickers they
concern. They do not, on the feed that matters. Finnhub's COMPANY news carries the symbol; its
MARKET news — 160 of the ~220 articles a night, and the Front Page's main source — carries an empty
`related` field on every single item. Marketaux does tag entities, but its free tier hands over three
articles per request. So most of the front page arrives with no idea what it is about, and the
clustering rule ("overlapping ticker sets") and the significance formula ("magnitude over the linked
tickers") both have nothing to stand on until something links them.

That something is this file, and it is deliberately DUMB: a lookup against the instrument table we
already hold, with no model anywhere near it. A language model asked "which stocks is this about?"
would answer plausibly and occasionally wrongly, and a wrong answer here is not a small error — it is
a card that tells the reader a story is about a company the story never mentions. Ruling C1 again:
the front page is edited by evidence.

PRECISION IS PREFERRED TO RECALL, AND THE ASYMMETRY IS THE DESIGN. A ticker we fail to link costs the
card one chip and costs the cluster some ranking magnitude. A ticker we link WRONGLY is a false
statement about a company, printed under a headline, next to a real price move. The first is a
shortfall; the second is a lie. So every rule below refuses when it is unsure.

The rules, strongest evidence first:

1. **An exchange-qualified ticker in the text** — "(NASDAQ: AAPL)", "NYSE:FSK". The article is doing
   the linking itself, and it is doing it in the one format that cannot mean anything else.
2. **A multi-word company name** — "General Motors", "Bank of America". Two or more words matched on
   a word boundary is strong: no English sentence contains "Bank of America" by accident.
3. **A single-word company name** — "Nvidia", "Pfizer", "Conmed". Accepted only when the word is not
   an ordinary English word and not a market term. A great many companies are named after ordinary
   words on purpose, and a headline about a target price is not a headline about Target Corporation.
   COMMON_WORDS is what stands between the Front Page and that class of nonsense, and the note beside
   it explains why a list of the WORDS works where a list of the NAMES could not.
RULE 4 EXISTED AND WAS DELETED, AND THE REASON IS THE MOST USEFUL THING IN THIS FILE.

There was a fourth rule: a bare uppercase token that happens to be a symbol ("AAPL slipped 2%"). It
passed every test against a 44-name test universe. Then it ran against PRODUCTION'S 12,933 names and
immediately produced:

    "US makes it easier to export Nvidia AI chips and military equipment to the UAE"  ->  UAE
    "Baker Hughes wins E.U. approval for Chart Industries deal after LNG tech divestiture"  ->  LNG

UAE is a country. LNG is a commodity. Both are also real listed symbols (an iShares ETF and Cheniere
Energy), because in a universe of thirteen thousand tickers, *almost every three-to-five letter
uppercase string is somebody's ticker*. A stoplist cannot save the rule: it would have to enumerate
every country code, every commodity abbreviation, every organisation acronym and every initialism in
English, and it would still be one headline behind.

And what did the rule buy? Almost nothing. Journalists write "Apple", not "AAPL". Across the whole
recorded night it produced no correct link that rules 1 to 3 did not already make.

So it is gone. That is this file's own doctrine applied to itself: a missed link costs a card one
chip; a false link prints a false statement about a company beside a real price move. When a rule's
upside is a chip and its downside is a lie, it does not matter how often it is right.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Corporate suffixes, stripped before a name is matched. "Apple Inc." is never written that way in a
# headline; "Apple" is. Ordered longest-first so "Co." does not eat the "Co" inside "Corporation".
_SUFFIXES = (
    "incorporated",
    "corporation",
    "technologies",
    "international",
    "holdings",
    "company",
    "limited",
    "group",
    "corp.",
    "corp",
    "inc.",
    "inc",
    "plc",
    "ltd.",
    "ltd",
    "llc",
    "n.v.",
    "s.a.",
    "a.g.",
    "ag",
    "co.",
    "co",
    "sa",
    "nv",
    "class a",
    "class b",
    "class c",
    "common stock",
    "the",
    "&",
)

# THE STOPLIST THAT REPLACED A STOPLIST, AND WHY THE FIRST ONE COULD NOT WORK.
#
# Rule 3 (a single-word company name) originally refused a hand-curated list of ~90 names that are
# also ordinary words — Target, Gap, Visa, Key, Match. Against production's 12,933 instruments that
# list was hopeless, and the front page immediately filled with false links:
#
#     "Strategy Inc"   -> the word "strategy" -> MSTR, on a story about a truck-maker acquisition
#     "People Inc"     -> the word "people"   -> PPLI, on a story about a parasite outbreak
#     "Popular, Inc."  -> the word "popular"  -> BPOP, on a story about viral internet trends
#     "Team, Inc."     -> the word "team"     -> TISI
#     "Fossil Group"   -> the word "fossil"   -> FOSL, on a story about nuclear power
#     "Nasdaq, Inc."   -> the word "Nasdaq"   -> NDAQ, on five separate stories about the INDEX
#
# The list was not too short. A curated list of exceptions can never keep up with thirteen thousand
# companies, a great many of them named after ordinary words on purpose. So the test is INVERTED:
# instead of listing the company names that are words, list the WORDS, and refuse any single-word
# company name that is one of them. This keeps "Nvidia", "Pfizer" and "Conmed" — which are not words —
# and refuses every name above, which are.
COMMON_WORDS: frozenset[str] = frozenset(
    """
    a about above accept access account across act action active add advance advantage after again
    against age agency agenda agree air all alliance alpha alternative always american among amount
    analysis anchor and another answer any apex appeal apply approach approval arch area arm around
    arrow art asset assurance at atlas attack attempt author auto autumn available avenue back bad
    balance bank base basic battery bay be bear because become before begin behind believe bell below
    benefit best beta better between beyond big bill black blank block blue board body bond bonus book
    boost border boston bottom box brand brands break bridge brief bright bring broad brother budget
    build building bull business but buy by call campaign can cannon capital captain car carbon card
    care career carnival carrier case cash catalyst cause cell center central century certain chain
    chair challenge champion chance change channel charge charter chase check chief child choice church
    circle citizen city civil claim class clean clear client climate clock close cloud club coach coast
    code cold colgate collect college color column combine come comfort command comment commerce common
    community company compare compass compete complete concept concern concord condition confidence
    connect consider constant consumer contact content contest context continental control convert core
    corner cost count country county couple course court cover craft create credit crest critical cross
    crown crystal culture current custom customer cut cycle daily data date dawn day deal decide deep
    defense degree deliver delta demand depend design desire detail develop diamond digital direct
    discovery discuss distinct district dollar domain double down dream drive drop dynamic eagle early
    earn earth ease east echo economy edge edit effect effort eight element elevate empire employ
    empower enable end endeavor energy engage engine enter enterprise entertainment envision equal
    equity era essential establish estate eternal even event ever every evolve exact example exchange
    excite executive exercise exist expand expect experience expert explore express extend extra face
    fact factor fair faith fall family far fast father favor federal feel field fifth fight figure file
    fill film final finance financial find fine finish fire first fiscal fisher fit five fix flag flash
    flat fleet flex flight floor flow focus follow food foot for force forest form format fortune
    forward foundation four fourth frame franklin free freedom fresh friend front fuel full function
    fund fusion future gain game gap garden gas gate gates gather general generation genius get giant
    gift give glass global globe go goal gold golden good govern grace grade grand grant graph great
    green grid ground group grow growth guard guide half hall hand happy harbor harmony harvest have
    head health hear heart heat help her here heritage high hill history hold holding home honor hope
    horizon host hour house how human hunt idea ideal identity image impact imperial improve in include
    income increase independent index industrial industries industry infinite influence inform initial
    inland inner innovate input inside insight inspire institute insurance integral intelligent interest
    internal international invest invesco investor iron island issue it item jack join journey joy judge
    jump junction just justice keep key kind king knowledge known lab labor lake land language large
    last late launch law lead leader learn leave left legacy legal lens level liberty life light like
    limit line link lion liquid list little live local lock logic long look lower loyal luck macro magna
    main maintain major make manage many marathon march marine mark market martin master match material
    materials matter maximum may meadow mean measure media medical meet member memory mention merit
    message metal method metro middle midland might mile mill million mind mine minute mirror mission
    model modern moment momentum money monitor month moon more morning most motion motor mountain move
    much music must mutual name nation national native natural nature navigator near need net network
    never new news next night nine noble none normal north northern note now nuclear number oak object
    observe ocean of off offer office often oil old omega on once one online only open opportunity
    optimal option or orange orbit order origin other our out outlook output over overseas own pace
    pacific package page paper paradigm paragon parallel paramount parent park part partner partners
    party pass past path patriot pattern pay peak peer people perfect perform period permanent person
    peter phase phoenix pick picture pilot pinnacle pioneer place plain plan plant play please plus
    point polar policy popular port portfolio position positive possible post potential power practice
    precision prefer premier premium prepare present preserve president press pressure price pride
    primary prime principal print prior priority private prize probe problem process produce product
    profile profit program progress project promise proper property propose protect proud prove provide
    public pull pure purpose pursue push quality quantum quarter quest question quick quiet race radiant
    radio raise rally range rapid rate reach read ready real reality realty reason rebel receive record
    red reduce reference reflect reform regal regency region regional register regular relate relative
    release relevant reliable relief remain remote renew rent repeat report represent republic request
    require research reserve resolute resolve resource resources respect respond response rest result
    retail return reveal revenue review revolution reward rich ride right rise risk river road rock role
    roll room root rose round route royal rule run rush safe sage sail sale salt same sample satellite
    save scale scene school science score search season second secure security see seek select sell
    send senior sense sentry serve service session set settle seven shade shadow shape share sharp
    shell shield shift shine ship shore short show side sight sign signal signature silver similar
    simple single site situation six size skill sky small smart snap social society solid solution
    solve some sonic sound source south southern space span spark special specific spectrum speed spire
    spirit split sponsor sport spot spread spring square stable staff stage stake stand standard stanley
    star start state station status stay steady steel step sterling stock stone stop store storm story
    straight strategy stream street strength strike strong structure student study style subject success
    sudden suffer suit summit sun sunrise superior supply support sure surface surge survey sustain
    swift switch symbol system table take talent talk target task team tech technology tell ten term
    terra test text than that the theme then there these they thing think third this thought three
    thrive through time title today together top total touch tower town trace track trade traffic trail
    train transfer transform transit travel treasure treat trend trial tribune trinity triple triumph
    true trust truth try turn twin two type union unique unit unite united unity universal universe up
    urban use user valley value vantage vector venture verify vertex very vessel veteran victory view
    vintage virtue vision visit vista visual vital voice volume vote voyage wage wait walk wall want war
    warrant watch water waters wave way wealth wear weather week welcome well west western what wheel
    when where which while white who why wide will win wind window wing winter wire wisdom wise with
    within without witness wolf woman wonder wood word work world worth would write year yes yield you
    young your zenith zone fossil apple visa oracle ford peloton chipotle dominion hormel
    olin omega sysco tyson vulcan whirlpool hershey humana expedia colgate kellogg loews
    mosaic newell nordson regency rollins ross ryder sempra tapestry textron welltower
    marathon lincoln franklin harley invesco jack cardinal aurora phoenix crown dollar
    liberty pioneer signature summit premier progress advance sunrise sturm cheniere apache
    arch diamond eagle hope brands range stone waters
""".split()
)

# Market vocabulary: not ordinary English, and never a company when a headline uses it. "Nasdaq ends
# sharply higher" is about the index. Nasdaq, Inc. is a real listed company and is not what that
# sentence is about — nor what any of the five headlines naming it were about.
MARKET_TERMS: frozenset[str] = frozenset(
    {
        "nasdaq", "nyse", "dow", "russell", "treasury", "fed", "sec", "ftc", "doj", "opec", "nato",
        "reuters", "bloomberg", "cnbc", "ipo", "etf", "amex", "cboe", "sp",
    }
)

# Rule 1: the article links itself. "(NASDAQ: AAPL)", "NYSE:FSK", "(NYSE: BRK.B)".
_EXCHANGE_TICKER = re.compile(
    r"\b(?:NASDAQ|NYSE(?:ARCA|AMERICAN)?|AMEX|OTC(?:MKTS)?|CBOE)\s*:\s*([A-Z][A-Z.\-]{0,6})\b"
)


@dataclass(frozen=True)
class Instrument:
    """One row of the instrument table, as the resolver needs it."""

    symbol: str
    name: str


def canonical_name(name: str) -> str:
    """
    A company's name as a headline would actually write it: no legal suffixes, no punctuation noise.

    "Apple Inc." → "apple". "Bank of America Corporation" → "bank of america". The suffix strip runs
    repeatedly because real names stack them ("Alphabet Inc. Class A").
    """
    text = name.lower().strip()
    text = re.sub(r"[,\.]+$", "", text)

    changed = True
    while changed:
        changed = False
        for suffix in _SUFFIXES:
            if text.endswith(" " + suffix):
                text = text[: -(len(suffix) + 1)].strip().rstrip(",.")
                changed = True
    return text.strip()


class TickerResolver:
    """
    Resolves article text to symbols, against a fixed universe.

    Built once per night from the instrument table and reused for every article — the name index is
    the expensive part and it does not change between articles.
    """

    def __init__(self, instruments: list[Instrument]) -> None:
        self._by_symbol = {inst.symbol.upper(): inst.symbol for inst in instruments}

        # Name → symbol, keyed on the canonical form. Where two companies canonicalize to the same
        # name, neither is matchable by name: an ambiguous name is not evidence, and picking one of
        # them would be inventing the link the whole file exists to avoid.
        names: dict[str, list[str]] = {}
        for inst in instruments:
            canon = canonical_name(inst.name)
            if canon:
                names.setdefault(canon, []).append(inst.symbol)

        self._by_name = {name: symbols[0] for name, symbols in names.items() if len(symbols) == 1}
        self._names_by_symbol = {inst.symbol: inst.name for inst in instruments}

        # One regex over every unambiguous name, longest first so "bank of america" wins over "bank"
        # if both were ever present. Matching all names in a single pass keeps this linear in the
        # article's length rather than in the size of the universe.
        matchable = [name for name in self._by_name if self._is_matchable(name)]
        self._name_pattern = (
            re.compile(
                r"(?<![\w])(?:"
                + "|".join(re.escape(name) for name in sorted(matchable, key=len, reverse=True))
                + r")(?![\w])",
                re.IGNORECASE,
            )
            if matchable
            else None
        )

    @staticmethod
    def _is_matchable(canon: str) -> bool:
        """
        May this canonical name be matched on its own, without an explicit ticker beside it?

        A multi-word name always may — "bank of america" does not occur in English by accident. A
        single-word name may only if it is not an ordinary word, which is what AMBIGUOUS_NAMES holds.
        """
        if " " in canon:
            return True
        if len(canon) <= 2:
            return False
        return canon not in COMMON_WORDS and canon not in MARKET_TERMS

    def resolve(self, text: str) -> tuple[str, ...]:
        """
        Every symbol this text is genuinely about, in the order the rules found them.

        Returns an empty tuple when nothing is certain — which is a real and common answer. A Fed
        decision names no company, and the Front Page has a shape for exactly that story.
        """
        if not text:
            return ()

        found: list[str] = []

        def remember(symbol: str) -> None:
            if symbol not in found:
                found.append(symbol)

        # Rule 1 — the article did the linking itself.
        for candidate in _EXCHANGE_TICKER.findall(text):
            symbol = self._by_symbol.get(candidate.upper())
            if symbol:
                remember(symbol)

        # Rules 2 and 3 — company names, in one pass.
        if self._name_pattern is not None:
            for match in self._name_pattern.finditer(text):
                symbol = self._by_name.get(match.group(0).lower())
                if symbol:
                    remember(symbol)

        return tuple(found)

    def agrees_on(self, symbol: str, provider_name: str | None) -> bool:
        """
        May we accept a symbol the PROVIDER tagged an article with?

        Two conditions, and both are necessary.

        1. **We must hold the instrument.** A symbol we have no listing for cannot be given a name, a
           price, a move or a setup card, so a chip for it would be a dead chip — and the room already
           has honest copy for a story with no listing in our universe. Marketaux routinely tags
           foreign and OTC lines (SKLTF, RYAOF, SAFRF) that this app does not carry.

        2. **The provider's company must be our company.** A symbol refers to an exchange, and
           providers tag against theirs. VHI is VitalHub on the Toronto exchange and Valhi, Inc. on
           the NYSE — and it was Valhi that nearly appeared under a headline about a Canadian health
           software acquisition, wearing Valhi's real price move. When the provider does not say which
           company it means, we cannot check, and an unverifiable tag is refused rather than assumed.
        """
        held = self._by_symbol.get(symbol.upper())
        if not held:
            return False

        if not provider_name:
            return False

        theirs = canonical_name(provider_name)
        ours = canonical_name(self._names_by_symbol.get(held, ""))
        if not theirs or not ours:
            return False

        # One name being a prefix of the other is agreement ("nvidia" vs "nvidia"), and so is a clean
        # containment ("vitalhub" vs "vitalhub corp"). Two unrelated names are not.
        return theirs == ours or theirs.startswith(ours) or ours.startswith(theirs)
