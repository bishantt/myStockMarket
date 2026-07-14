/**
 * copy.ts — the canonical copy deck (plan Appendix J).
 *
 * Every reader-facing sentence that carries a guardrail lives here, verbatim. Components import
 * from this file; they never inline a sentence of their own. That is not a style preference —
 * these strings ARE the honesty rules in their final, human form:
 *
 *   - "A tendency, not a prediction."      keeps a base rate from reading as a forecast.
 *   - "No news found — ... likely noise."  is what stops a bare +8% from inviting a chase.
 *   - "Insufficient history ..."           is the N < 30 suppression, spoken.
 *
 * Changing any string in this file is a STRUCTURAL decision (plan §1.3.3): Appendix J changes
 * are never local edits. A unit test pins every one of them to the Appendix, so a well-meant
 * rewording fails the build rather than quietly softening a warning.
 *
 * Voice (plan §3.9, Research Report §9.4): mechanical third person. "The pattern has
 * historically been followed by..." — never "I think". Sentence case. No exclamation marks.
 * Curly quotes and em dashes are deliberate; this is a broadsheet.
 */

/**
 * Placeholders are written as {name} and filled by `fill()` below. They are left unfilled here
 * so the deck stays greppable: searching for a rendered sentence in the codebase finds exactly
 * one hit, in this file.
 */
export const copy = {
  baseRate: {
    /** The canonical natural-frequency sentence. Never render a base rate any other way. */
    sentence:
      "In the past {years} years, this pattern appeared {n} times on {refClass}. Price was higher {h} trading days later in {wins} of {n} cases ({pct}).",
    /** N < 30. The percentage is suppressed entirely — not shrunk, not hedged. Suppressed. */
    insufficient: "Insufficient history (N = {n}) — treat as anecdote.",
    /** The always-up baseline, shown beside every base rate so 56% cannot masquerade as an edge. */
    baseline: "Unconditional {h}-day up-rate ≈ {pct} — read this against that baseline.",
    /** N 30–99: the wide-interval note that MUST accompany the natural-frequency form (Appendix J
     * addition, 2026-07-11 — the plan mandates the note but left the wording to compose; logged in
     * DECISIONS). Renders in place of the CI numerals, which are suppressed at this sample size. */
    wideInterval: "Sample still small — the true rate could sit some way either side of this.",
  },

  /**
   * Tier actions come from a fixed lexicon, and every one of them is observational. No tier
   * ever maps to an acquisitional verb — "worth a closer look", never "buy". (RR §9.4.)
   */
  tier: {
    strong: "worth a closer look",
    moderate: "note it; check the weakeners",
    weak: "watch only",
  },

  volband: {
    label: "In the past, 8 in 10 {h}-day paths from here stayed inside this range.",
    /** Never rendered without the label. A band without its caveat is a forecast. (§1.5 rule 1.) */
    caveat: "Ranges assume the recent regime holds — sudden stress can exceed them.",
  },

  /** The dot array inside BaseRate. Every dot is one case — the misses are the point. */
  dotarray: {
    caption: "Each dot is one historical case. Misses are intentionally visible.",
  },

  /** The quantile dotplot: 20 dots, each one-in-twenty of the historical outcomes. */
  dotplot: {
    caption: "Each dot: 1 in 20 past outcomes.",
  },

  /**
   * THE WINDOW VOCABULARY — a closed set (ruling C2, NEWS-AND-CONTROL-PLAN Appendix B).
   *
   * Every number in this app states the period it covers, in the same visual unit as the number
   * itself — not in a footnote, not only in a module footer. "+8.2%" is not a fact; "+8.2% · 1D"
   * is. The vocabulary is closed and lives here so that every surface says "20d avg" the same way,
   * and so a test can check that a metric label carries one of these tokens at all.
   */
  window: {
    d1: "1D",
    d5: "5D",
    m1: "1M",
    m3: "3M",
    m6: "6M",
    y1: "1Y",
    y5: "5Y",
    avg20d: "20d avg",
    avg50d: "50d avg",
    rsi14: "14d",
    weekOf: "wk of {date}",
    monthOf: "{month} {year}",
    asOf: "as of {date}",
    atClose: "at {day}'s close",
    vsPriorClose: "vs prior close",
    /**
     * Added in N3, on purpose and in a diff — which is what the closed set is FOR.
     *
     * The macro board states a mortgage rate's change against LAST WEEK'S survey, and there was no
     * honest way to say that with the tokens that existed. "5D" would have been a lie of precision:
     * Freddie Mac publishes a weekly survey, not five trading days of quotes, and a reader learning
     * what these words mean deserves the one that is true.
     */
    vsPriorWeek: "vs prior week",
  },

  /**
   * The macro strip (redesign §6.1, extended by NEWS-AND-CONTROL-PLAN Part 3).
   *
   * These strings exist because an ETF is not its index: SPY traded near 755 while the S&P 500 was
   * near 6,800, and the Desk printed the former under the latter's name.
   *
   * WHAT CHANGED IN N1 — one mark per row, and a footer that cannot lie.
   *
   * The old grammar said "ETF proxy" TWICE on every proxy row: once as a label suffix
   * ("S&P 500 · SPY (ETF proxy)") and again as a freestanding chip. On screen that reads as noise,
   * and noise is where a beginner stops reading. Now there is exactly ONE proxy mark: the chip.
   *
   * And `provenance` is gone. It was a static sentence — "Index levels · FRED · prior close" —
   * rendered under whatever the rows happened to show, so on the night FRED's index series failed
   * it sat under four ETF prices and claimed they were FRED index levels. A provenance line that
   * can disagree with its own surface is worse than none at all. It is now COMPOSED from the rows
   * actually rendered (ruling C6, buildMacroProvenance in lib/morning.ts).
   */
  macro: {
    /** The single proxy mark on a slot that is an ETF BY DESIGN (small caps — no free index series). */
    proxyChip: "{symbol} · ETF price",
    /**
     * The proxy mark on an index slot that DEGRADED to an ETF. It negates the misreading outright,
     * because this is the one case where an index's name and an ETF's price share a row.
     */
    proxyChipDegraded: "{symbol} · ETF price — not the index level",
    /** QQQ tracks the Nasdaq-100, not the Composite. The mismatch is stated, never blurred. */
    proxyChipNasdaq: "QQQ · Nasdaq-100 ETF price — not the Composite",
    proxyNote: "{symbol} is an ETF whose price tracks this group; it is not the index level.",
    /** Shown on a slot whose stored index level is real but not tonight's (ruling C7). */
    staleLevel: "as of {date}",
    /** The provenance line when every index series failed — stated, not implied by an absence. */
    indexesUnavailable: "Index levels unavailable tonight — showing ETF closes, labeled per row",
    /** Breadth gains its as-of, like every other number (C2). */
    breadthClose: "at {day}'s close",
  },

  /**
   * THE MACRO BOARD (NEWS-AND-CONTROL-PLAN Part 6, Appendix B).
   *
   * Five household stats that answer what a market number cannot: what does a mortgage cost, what
   * did prices do, what is gold worth, what is a dollar worth in rupees — and how does the market
   * feel. The first four are other people's numbers, and the strings below name whose. The fifth is
   * OURS, and the strings below say so out loud, because that is the only thing that makes it
   * legitimate to show at all.
   */
  macroBoard: {
    mortgageLabel: "30-yr mortgage",
    mortgageNote: "Average rate on a 30-year fixed mortgage — the price of housing money.",
    cpiLabel: "Inflation (CPI YoY)",
    cpiNote: "Consumer prices vs the same month last year, as published.",
    goldLabel: "Gold (oz)",
    /**
     * "Indicative spot reference" — and NEVER "LBMA price", never "COMEX settlement". Those are
     * licensed benchmarks with precise meanings that this app has not bought and cannot verify.
     * Borrowing their authority for a different number is the exact species of lie C6 exists to stop.
     */
    goldProvenance: "indicative spot reference · GoldAPI",
    nprLabel: "USD → NPR",
    /** The pair, never one side: picking a side silently answers a question the reader never asked. */
    nprPair: "{buy} buy · {sell} sell",
    /**
     * Mandatory. We quote no remittance app — none exposes a legitimate rate API — so rather than
     * inventing one, the cell says plainly that the number it shows is not the number you will get.
     */
    nprQualifier: "Remittance apps may differ.",
    nprSourceNrb: "NRB reference",
    nprSourceMid: "mid-market reference",
    nprWeekendNote: "weekends carry Friday's fix",
    /** A licence condition of the fallback source, rendered as a link whenever it is the one showing. */
    erApiAttribution: "Rates By Exchange Rate API",

    moodLabel: "Mood gauge",
    /**
     * Ruling C8's sentence. The gauge is ours because no legitimate external one exists to license,
     * and a home-built sentiment number that does not say it is home-built is just a rumour with a
     * decimal point.
     */
    moodOwnership:
      "Computed by this app from breadth, volatility, momentum, range position, and credit spreads — not CNN's index.",
    /** It is not a signal, and nothing in this app has ever measured what a 42 is followed by. */
    moodContext: "Context, not a signal — no tendency evidence attaches to this number.",
    /** Under three components there is no gauge — and the reader is told which instruments are down. */
    moodInsufficient: "Insufficient inputs tonight — missing: {names}.",

    /** C7 rung 4: no history at all. Information, not an apology. */
    notYetReported: "not yet reported",
    /** C7 rung 3: the value stands, and its age is stated rather than quietly worn. */
    sourceUnreachable: "source unreachable tonight",
    /** C7 rung 5: old enough that the number now misleads more than it informs. The amber cell. */
    staleCell: "stale — last {asOf}",
  },

  /**
   * The Mood gauge's word bands. Deliberately FLAT — there is no "extreme" band here.
   *
   * "Extreme greed" is a phrase that manufactures urgency, and urgency is the one thing this
   * product refuses to sell. The words describe; they do not exhort.
   */
  moodBands: {
    f0: "fearful",
    f25: "leaning fearful",
    mid: "mixed",
    g56: "leaning greedy",
    g76: "greedy",
  },

  desk: {
    edition: "The Desk — Evening Edition",
    status: "Markets {state} · data as of {close} · updated {stamp}",
    /** Module 07 as a GLANCE: a figure, not a paragraph pointing at another page. */
    scanCount: "{n} matches across {k} scans",
  },

  /**
   * THE PIPELINE STRIP (NEWS-AND-CONTROL-PLAN Part 4.1, Appendix B).
   *
   * Module 00 used to spend a whole card — the best position on the phone — saying "last cloud run
   * — Jul 11" in the same quiet voice every day, whether the pipeline was healthy or three days
   * dead. Its payload was one date and a status that is almost always "fine".
   *
   * These four strings are the replacement, and the ESCALATION between them is the honest part.
   * Freshness is prominent in proportion to how BAD the news is: a live pipeline earns one quiet
   * line, a stale one earns amber, a dead one earns the loudest surface in the app. The old design
   * spent hero space on the boring case and had no escalation at all for the frightening one.
   */
  strip: {
    fresh: "Data through {day} close · pipeline ran {time} · next: {next}",
    aging: "No run for {day}'s session · showing {lastDay}'s data · check the pipeline →",
    dead: "The pipeline has not run since {lastDay}. Every number on this page is from that night. Check the pipeline →",
    /** An empty database is not a dead pipeline — it is one that has not started. No alarm. */
    never: "No pipeline run recorded yet · the nightly jobs write here after each US close",
    /** The word that makes the amber mean something. It names the state, so colour is never alone. */
    staleWord: "stale",
    deadWord: "pipeline down",
  },

  mover: {
    /** The honest alternative to inventing a reason. A mover renders this or a real catalyst. */
    noNews: "No news found — most moves this size have no identifiable cause; likely noise.",
    /** The empty Desk: no mover cleared the bar. Information, not an apology. */
    quiet: "No moves cleared the catalyst-or-noise bar today.",
    relvolNote:
      'RelVol = volume ÷ 20-day average. "No clear catalyst" usually means noise; a cause sometimes surfaces later — absence of news is not a reason to act.',
  },

  calendar: {
    /** "No edge" is a first-class outcome with its own rendering, never an apology. */
    noEdge: "No clear edge either way — that is a valid outcome.",
    /** The word beside a high-importance row's dot — outcome never rides on colour alone. */
    importanceHigh: "high",
    /**
     * The empty calendar is a signature, not a failure. The allowlist drops every non-catalyst
     * FRED release, so a genuinely quiet fortnight now renders as one — and says why.
     */
    empty: "A quiet stretch — no scheduled catalysts in the next 14 days.",
    emptySub: "Curated from the full FRED release feed; the rest was noise.",
    /** M8 (app-feel): the cut is named — the reader is told what they are seeing and through when. */
    next: "Next {k} of {n} · through {date}",
  },

  brief: {
    /** When the verification gate holds the briefing, this is what ships. It beats a guess. */
    unavailable: "Briefing unavailable tonight — scan results below are complete and verified.",
  },

  /**
   * The Front Page (NEWS-AND-CONTROL-PLAN Part 7, Appendix B).
   *
   * ONE STRING HERE IS NOT THE PLAN'S, AND THE REASON IS THE WHOLE ETHIC OF THE ROOM.
   *
   * Appendix B wrote the ordering sentence as: "Ordered by catalyst significance — scope,
   * corroboration, and the size of the move it explains." Every word of that is true about the
   * FORMULA, and it is misleading about the PAGE, because on the real feed two of those three terms
   * barely vary:
   *
   *   - corroboration is 1 for 131 of 134 clusters (three outlets, few genuine duplicates)
   *   - magnitude is 0 for ~130 of them (most stories name no listed company, so there is no move)
   *
   * That is 45% of the formula's weight sitting nearly constant, so the order collapses onto scope
   * and the catalyst's class — and ten or more stories routinely tie at exactly the same score, with
   * the lead decided by which was published first. A sentence promising a ranking by three
   * discriminating signals, printed above a page where two of them discriminate nothing, is the app
   * flattering its own machinery. So the sentence SAYS the ties are there, and says how they break.
   *
   * The honest fix was to change the words, not the ranking. Inventing a tiebreaker — a
   * "US-market relevance" term, say — would be the app forming an editorial opinion about which
   * stories deserve the front page, which is the one thing ruling C1 forbids. On a day when the Gulf
   * is on fire, a wall of Gulf stories IS the honest front page. (Q-N4-1; amendment logged.)
   */
  news: {
    roomTitle: "Front page",
    pressTime: "Assembled {date} {time} ET · from {articles} articles, {clusters} catalysts",
    ordering:
      "Ordered by catalyst significance: how broad the event is, how many separate outlets carried it, and how large a move it explains. Stories that score the same tie, and ties run oldest first.",
    /** C10. The room is a newspaper: it has a press time, and it does not pretend to be a wire. */
    cadence: "Assembled nightly after the US close. This page does not update during the day.",
    countLine: "{n} catalysts{filters}",
    zeroState: "No {filter} catalysts today — that is information, not an error.",
    reset: "Clear filters",
    /** C9. It affects everything and names nothing — which is a fact about the story, not a gap. */
    noListing: "No direct listing in our universe.",
    noStoryHeader: "Moved without a story",
    sources: "{n} sources",
    oneSource: "1 source",
    photoVia: "Photo via {source}",
    /**
     * A story published BEFORE the app kept its article list (every row in production written before
     * N5's migration). The count is real — it was computed from articles that existed — but they were
     * not saved, so it cannot be opened. Saying that is the only honest move available: printing the
     * "Sources" heading over an empty list would tell the reader the story had none, which is false,
     * and hiding the section entirely would hide the fact that the claim is uncheckable.
     */
    sourcesNotKept:
      "The articles behind this story were not kept when it was published, so this count cannot be opened. Stories published from now on carry their sources.",
    deskPreviewCut: "First {n} of {total} by significance",
    deskDoorway: "The full front page →",
    provenance:
      "Ingested {time} · extracted by {model} · every number machine-verified against its sources",
    whatHappened: "What happened",
    whyItMatters: "Why it matters",
    byTheNumbers: "By the numbers",
    affected: "Affected tickers",
    learn: "Learn the mechanism",
    setupCard: "Setup card",
    backToFeed: "← Back to the front page",
    sourceList: "Sources",
    weekUnavailable: "less than a week of coverage so far — showing all of it",
    /**
     * The gate-dropped note, and it is deliberately NOT rendered on the card — a null prints
     * nothing there (P9). This line exists for the STORY page, where a reader who came looking for
     * the "why" is owed the reason there is none. Silence on a card is restraint; silence on the
     * page devoted to one story would be a hole.
     */
    noteDropped:
      "No context line for this story: the one written failed the number check, so it was dropped rather than published unverified.",
    /** The narrator honestly had nothing to add. Different from the line above, and it says so. */
    noteAbsent: "No context line for this story.",
  },

  /**
   * The login wall. Even the marketing-flavoured lines obey the one-deck rule and the mechanical
   * voice — the first page a reader ever sees is not the place to start over-promising.
   */
  login: {
    headline: "Your personal broadsheet for the market.",
    subline:
      "Not a prediction oracle. Not a signal feed. A daily record of what happened, why it might matter, and what the base rates actually say — including the misses.",
    quote: "“An investor who has all the answers doesn’t even understand the questions.”",
    quoteAttribution: "— Sir John Templeton",
    /** The licensing reason the wall exists at all. */
    wall: "This app stays behind a login because its market data is licensed for personal use only.",
    submit: "Open my desk →",
  },

  /** The Academy's closing pull quote. One fixed quote — a rotating one is a slot machine. */
  academy: {
    quote:
      "“The first step to understanding markets is understanding that no one fully understands markets.”",
    /** Position, stated as a count — never a progress bar (P13: position over area). */
    readCount: "{read} of {n} read",
  },

  palette: {
    hint: "⌘K",
    placeholder: "Go to a room, lesson, or ticker…",
  },

  offline: {
    ribbon: "Offline — showing the last synced briefing ({date}).",
  },

  scope: {
    /** Sits on every setup card. Four words doing most of the product's ethical work. */
    line: "A tendency, not a prediction.",
  },

  decision: {
    /** Rendered at the decision point, never in a page footer. (RR §9.4.) */
    disclaimer: "Historical tendency — verify before acting.",
  },

  coolingOff: {
    body: "You are entering a paper trade within {min} minutes of seeing this signal. The historical base rate is {rate} with the interval shown; costs are certain. Proceed, or sit with it until tomorrow’s brief?",
  },

  brier: {
    /** A Brier score means nothing to a beginner without this anchor beside it. */
    anchor: "0.25 = coin flip",
  },

  attribution: {
    /** A licence condition of using the FRED API, not a courtesy. */
    fred: "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.",
  },

  degraded: {
    /** A source can fail without the run failing — and the reader is told which. */
    source: "{source} unavailable tonight — this section is running without it.",
  },

  save: {
    /** There is no offline write queue in v1, so a write that cannot happen says so. */
    offline: "Reconnect to save.",
  },

  update: {
    /** The service worker's update prompt. Calm: a footer line, never a toast or a modal. */
    ready: "Updated — refresh when convenient.",
  },

  /**
   * The app-feel additions (APP-FEEL-PLAN Appendix B). Same rule as everything above: these are
   * not labels, they are the honesty rules in their final human form.
   */
  /**
   * The watchlist's own window statements (ruling C2, NEWS-AND-CONTROL-PLAN Part 5.1).
   *
   * The sparkline was the least honest thing on the Desk: a line with no axis, no scale, and no
   * period. A shape that says "up" over an unstated stretch of time is not information — a month and
   * a year produce the same picture and mean opposite things.
   */
  watchlist: {
    sparkCaption: "Sparklines: 30 sessions, close only",
  },

  /**
   * The control room (N6, plan Part 8 + Appendix B).
   *
   * THE "NOT AVAILABLE" SENTENCES ARE THE FEATURE, not the error messages around the feature.
   *
   * The commission asked for buttons that re-run the pipeline. Part 8.1 did the honest evaluation
   * and found that on a normal weeknight the pipeline HAS ALREADY RUN, and a manual re-run would
   * recompute byte-identical data. For that case — which is most cases — **the honest control is the
   * EXPLANATION, not the button.** So most of the time this panel is not a row of buttons at all. It
   * is a short piece of writing that tells the reader why there is nothing worth pressing, and when
   * there will be. Ruling C5: an empty state is information, not an apology.
   *
   * A button that is present but pointless invites a press that changes nothing, and a product that
   * lets you do something pointless and says nothing about it has lied to you about what you did.
   */
  control: {
    title: "Pipeline",

    runFull: "Run tonight's full pipeline",
    runFullDesc: "Ingest the close, recompute everything, publish.",
    runNews: "Refresh the news",
    /**
     * `{cost}` is a MEASURED number (lib/constants NEWS_RUN_COST_USD), not a guess, and it is
     * printed because this is the only button that spends money. N5 amended news mode's promise: it
     * runs the narrator now — up to 60 Haiku extracts and one Sonnet call — because the honest scope
     * of "refresh the news" is the WHOLE page, facts and context lines together. A refresh that
     * rebuilt the stories while silently blanking their notes would be a button that quietly makes
     * the page worse, which is not a refresh.
     */
    runNewsDesc: "Fetch today's articles, re-rank the front page. ~{cost} of API budget.",
    runMacro: "Refresh macro stats",
    runMacroDesc: "Re-read rates, gold, FX and the gauge inputs.",
    runCompute: "Recompute scans",
    runComputeDesc: "Re-run indicators and scans over stored data. No new data is fetched.",
    runBriefing: "Re-run the evening briefing",
    runBriefingDesc: "Re-assemble tonight's brief from the data already stored.",

    capLine: "{left} of {cap} left today",
    cooldown: "available again at {time}",
    capped: "daily limit reached — resets midnight ET",

    queuedBehind: "queued behind tonight's scheduled run",
    running: "running — {elapsed}",

    /**
     * What the OTHER buttons say while one run is in flight (plan 8.4).
     *
     * The jobs share a GitHub concurrency group (`msm-nightly`, cancel-in-progress false), so runs
     * are serialized — and GitHub keeps only the LATEST queued run in a group, silently discarding
     * any it superseded. So a second dispatch fired now would not "also run"; it might simply
     * evaporate. The panel refuses it as a STATE rather than letting the reader press a button whose
     * result would be a run that quietly never happened.
     */
    blocked: "waiting for the run already in flight",

    // The C5 explanations. Each one names the reason AND the next moment something changes, because
    // "not available" without a "next" is a dead end, and a dead end is where a reader gives up.
    naMarketOpen:
      "Markets are open — today's closing data doesn't exist until 4:00pm ET. The nightly run lands ~{nightly} ET.",
    naWeekend:
      "It's the weekend — {lastDay}'s close is the latest data that exists; nothing new lands before {nextDay} 4:00pm ET.",
    naHoliday: "US markets are closed today ({name}) — {lastDay}'s close stands until {nextDay}.",
    naAlreadyRan: "Tonight's run already succeeded at {time} — there is nothing newer to fetch.",

    /**
     * P-2 is not provisioned. The panel renders every one of its real states against the missing
     * secret and says plainly what is missing — it does not hide, and it does not pretend to work.
     */
    notConfigured: "Manual runs need a GitHub token — see QUESTIONS-FOR-BISHANT (P-2).",

    /**
     * THE SENTENCE THAT STOPS A SILENT FAILURE.
     *
     * The dispatch API answers 204 with an empty body, so the run id is not returned — it has to be
     * recovered by matching the request id in the run's name. Usually that takes a second or two.
     * When it never resolves, the panel must NOT sit on "requested…" indefinitely, because then a
     * run that fired and a run that never fired look exactly the same from the couch. It says this
     * instead, and links the Actions tab so the reader can see for themselves.
     */
    lost: "Dispatched, but the run never appeared. It may still be starting — check the Actions tab.",
    failed: "That run failed.",
    viewRun: "View the run log →",

    history: "Recent manual runs",
    /** The empty history. Nothing has been run by hand — which is the normal, healthy state. */
    historyEmpty: "You haven't run anything by hand yet. The scheduled runs are doing their job.",
  },

  /** The ticker's chart captions — what the bars ARE, and through when (C2). */
  ticker: {
    rangeCaption: "Daily bars · adjusted · through {date}",
    rangeCoverage: "Showing full history: {years}",
    rangeUnavailable: "Less than {min} of history for this symbol",
    lastCloseWindow: "1D vs prior close",
  },

  scans: {
    /**
     * Ruling M1, spoken. It is the sentence that separates a scan table from a leaderboard, and it
     * has exactly one home: under the table, as the DataTable's footnote.
     */
    tableNote:
      "Matches are filter hits, not forecasts. Sorting re-orders today’s matches; it never ranks tomorrow.",
    /** The name of the pipeline's own order. Never "top", never "best". */
    order: "scan order",
    /** M8: a preview states its rule. Never "highlights", never an unlabelled slice. */
    preview: "First {k} of {n} by scan order",
    allMatches: "All {n} matches →",
    /**
     * The 500-row cap. It is an honest editorial as much as a limit: a filter that matches this
     * many names out of ~6,000 has stopped filtering. Sorting is disabled above it, because sorting
     * a silent subset would present "the biggest movers among the most salient" as "the biggest
     * movers" — an unlabelled ranking, which is the exact species ruling M1 exists to kill.
     */
    cap: "Showing the first 500 of {n} by scan order — a filter matching this many names is closer to noise than a signal. Sorting is off above the cap.",
    /** An empty scan is a result, not a shelf to apologise for. */
    empty: "0 matches today — the filter ran and found nothing. That is information.",
    lotteryChip: "lottery risk",
  },

  table: {
    /** M6: position as words, never a progress bar (P13). */
    page: "Page {p} of {t} · {n} rows",
    sortHint: "Sort",
  },

  disclosure: {
    /**
     * M2's contract in one string: a collapsed summary must always say HOW MUCH it is hiding and
     * as of WHEN. A disclosure that hides an unstated number of things is a disclosure that can
     * hide a miss.
     */
    more: "+ {n} more · {context}",
    calendar: "Full calendar",
    movers: "All movers",
    watchlist: "Full watchlist",
    sources: "Per-provider detail",
  },

  pulse: {
    /**
     * M8, for a shelf: the reader is told what is off-screen and how to reach it.
     *
     * THE MACRO PULSE NO LONGER HAS A SHELF, AND THIS KEY DELIBERATELY OUTLIVES THAT (PD4).
     *
     * Two sibling strings used to live here — `marketsShelf` ("Markets — {n} figures, swipe") and
     * `moneyShelf` — and they are DELETED, because their consumers are. PD4 replaced both of the
     * Desk's swipe-shelves with grids that show every figure at once (amendment 0.2.1), and a count
     * line announcing what is off the edge of the screen is a lie when nothing is. M8 required those
     * strings precisely because the shelves hid things; the honest way to satisfy M8 is to stop
     * hiding things, and then the sentence has no work left to do.
     *
     * This one survives because the `Shelf` primitive survives — it remains the house rail for
     * filter-chip rows and any future glance rail, and the styleguide renders a live specimen of it.
     * A primitive with no demo is a primitive that rots.
     */
    swipe: "5 figures — swipe",
  },

  journal: {
    /** A collapsed journal still reports its state honestly — a zero is state, not an offer. */
    savedNone: "none saved tonight",
    savedOne: "1 saved tonight",
  },

  sources: {
    allOk: "{n} sources · all reporting · ran {window}",
  },

  paper: {
    /**
     * The date is load-bearing, not decoration. A served bar can be days old around a holiday or a
     * data gap, and "last close" without its date is an implicit freshness claim the reader cannot
     * check. The disclaimer covers liveness; the date covers age. They are different lies to prevent.
     */
    lastClose: "Use last close ({date}) · {price} — a reference, not a quote",
    /** M9: side has no default, so missing it is a plain validation message, not a nudge. */
    sideRequired: "Choose buy or sell.",
    /** Ruling M10: mechanical, practice-framed, and never styled as a button. */
    practiceDoorway: "Practice on paper →",
    closedTrades: "Closed trades",
  },
} as const;

/** The values a copy template can be filled with. Numbers are stringified as-is. */
export type CopyValues = Readonly<Record<string, string | number>>;

/**
 * Substitutes {placeholders} in a copy-deck string.
 *
 * Deliberately strict in both directions, because a half-rendered guardrail is worse than a
 * crash: a missing value throws rather than leaving a literal "{n}" on screen, and an extra
 * value throws rather than being silently ignored (which is almost always a renamed
 * placeholder and a sentence that now says something subtly different).
 *
 * @param template a string from the `copy` deck above — never a string literal from a component
 * @param values   one entry per {placeholder} in the template, no more and no fewer
 */
export function fill(template: string, values: CopyValues = {}): string {
  const required = new Set(
    [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]),
  );
  const provided = new Set(Object.keys(values));

  const missing = [...required].filter((key) => !provided.has(key));
  if (missing.length > 0) {
    throw new Error(
      `Copy template is missing value(s) for: ${missing.join(", ")}. Template: "${template}"`,
    );
  }

  const unused = [...provided].filter((key) => !required.has(key));
  if (unused.length > 0) {
    throw new Error(
      `Copy template got value(s) it has no placeholder for: ${unused.join(", ")}. ` +
        `This usually means a placeholder was renamed. Template: "${template}"`,
    );
  }

  return template.replaceAll(/\{(\w+)\}/g, (_match, key: string) =>
    String(values[key]),
  );
}
