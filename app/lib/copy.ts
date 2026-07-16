/**
 * copy.ts — the canonical copy deck (plan Appendix J).
 *
 * Every guardrail-bearing sentence lives here verbatim; components import, never inline. These
 * strings ARE the honesty rules in final human form — "A tendency, not a prediction" keeps a base
 * rate from reading as a forecast; "likely noise" stops a bare +8% from inviting a chase. Changing
 * any string is a STRUCTURAL decision (plan §1.3.3), and a unit test pins every one to the Appendix,
 * so a rewording fails the build rather than softening a warning. Voice (§3.9): mechanical third
 * person, sentence case, no exclamation marks; curly quotes and em dashes are deliberate.
 *
 * Placeholders are {name}, filled by `fill()` below; left unfilled so the deck stays greppable.
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
    /** N 30–99: replaces the suppressed CI numerals (Appendix J addition 2026-07-11 — wording
     * composed per the plan, logged in DECISIONS). */
    wideInterval: "Sample still small — the true rate could sit some way either side of this.",
  },

  /** Tier actions are a fixed, observational lexicon — "worth a closer look", never "buy" (RR §9.4). */
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
   * THE WINDOW VOCABULARY — a closed set (ruling C2, NEWS-AND-CONTROL Appendix B). Every number
   * states its period in the same visual unit as the number ("+8.2% · 1D", never bare "+8.2%").
   * Closed and central so every surface says "20d avg" alike and a test can check a label carries one.
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
     * Added in N3, in a diff — which is what the closed set is FOR. The macro board states a mortgage
     * rate's change against last week's survey; "5D" would be a lie of precision (Freddie Mac
     * publishes a weekly survey, not five trading days).
     */
    vsPriorWeek: "vs prior week",
  },

  /**
   * The macro strip (redesign §6.1, NEWS-AND-CONTROL Part 3). An ETF is not its index — SPY near 755
   * under the S&P 500's name near 6,800 — so each proxy row carries exactly ONE proxy mark (the chip;
   * N1 removed the duplicate suffix). `provenance` is gone: a static "FRED index levels" line sat under
   * ETF prices the night FRED failed, so it is now COMPOSED from the rows rendered (ruling C6,
   * buildMacroProvenance in lib/morning.ts).
   */
  macro: {
    /** The single proxy mark on a slot that is an ETF BY DESIGN (small caps — no free index series). */
    proxyChip: "{symbol} · ETF price",
    /** The proxy mark on an index slot that DEGRADED to an ETF — the one case where an index's name
     * and an ETF's price share a row, so it negates the misreading outright. */
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
   * THE MACRO BOARD (NEWS-AND-CONTROL Part 6, Appendix B). Five household stats: mortgage, CPI, gold,
   * USD→NPR, and the Mood gauge. The first four are other people's numbers and the strings name whose;
   * the fifth is OURS and says so out loud, the only thing that makes it legitimate to show.
   */
  macroBoard: {
    mortgageLabel: "30-yr mortgage",
    mortgageNote: "Average rate on a 30-year fixed mortgage — the price of housing money.",
    cpiLabel: "Inflation (CPI YoY)",
    cpiNote: "Consumer prices vs the same month last year, as published.",
    goldLabel: "Gold (oz)",
    /**
     * "Indicative spot reference", NEVER "LBMA price" or "COMEX settlement" — licensed benchmarks this
     * app has not bought and cannot verify. Borrowing their authority is the lie C6 exists to stop.
     */
    goldProvenance: "indicative spot reference · GoldAPI",
    nprLabel: "USD → NPR",
    /** The pair, never one side: picking a side silently answers a question the reader never asked. */
    nprPair: "{buy} buy · {sell} sell",
    /** Mandatory: no remittance app exposes a legitimate rate API, so the cell says plainly that this
     * is not the number you will get. */
    nprQualifier: "Remittance apps may differ.",
    nprSourceNrb: "NRB reference",
    nprSourceMid: "mid-market reference",
    nprWeekendNote: "weekends carry Friday's fix",
    /** A licence condition of the fallback source, rendered as a link whenever it is the one showing. */
    erApiAttribution: "Rates By Exchange Rate API",

    moodLabel: "Mood gauge",
    /** Ruling C8: the gauge is ours because no external one exists to license, and an unlabeled
     * home-built sentiment number is a rumour with a decimal point. */
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
   * The Mood gauge's word bands — deliberately FLAT, no "extreme" band. "Extreme greed" manufactures
   * urgency, the one thing this product refuses to sell. The words describe; they do not exhort.
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
    /**
     * The masthead's line 3 (CC3, ruling R3). Reader voice, weekday first. The market's state left
     * this line for the pill — one truth per line — and the data vintage the strip used to carry
     * ("Data through Tue's close") is stated HERE now, once: "{weekday}'s close".
     */
    status: "{weekday}'s close · updated {stamp}",
    /** Module 07 as a GLANCE: a figure, not a paragraph pointing at another page. */
    scanCount: "{n} matches across {k} scans",
  },

  /** Chrome aria copy. The toggle names its DESTINATION so the spoken label and the icon agree. */
  theme: {
    toggleAria: "Switch to {mode} theme",
  },

  /**
   * THE PIPELINE STRIP (NEWS-AND-CONTROL Part 4.1, Appendix B). Replaces Module 00, which spent the
   * phone's best card saying "last run — Jul 11" in the same quiet voice whether healthy or three days
   * dead. The ESCALATION is the honest part: freshness is prominent in proportion to how bad the news
   * is — a live pipeline earns one quiet line, a stale one amber, a dead one the loudest surface.
   */
  strip: {
    /**
     * CC3 (R3): PROVENANCE voice only. The data vintage and the ran-time moved up to the masthead
     * (line 3, "Tuesday's close · updated 7:36 PM ET"); this line names what a provenance stamp
     * should — sources reporting, sources degraded, and when the next edition lands.
     */
    fresh: "{n} sources · {degraded} degraded · next edition {day} ~{time}",
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
    /** The card-level line when NO mover has a catalyst (D10): the identical per-row noise line
     * printed three times in one viewport is noise about noise, so it is said ONCE for the card. The
     * per-row lines return the moment one mover DOES carry a catalyst (the mixed case). */
    allNoise: "No news found on any of these — most moves this size are noise.",
    /** The empty Desk: no mover cleared the bar. Information, not an apology. */
    quiet: "No moves cleared the catalyst-or-noise bar today.",
    relvolNote:
      'RelVol = volume ÷ 20-day average. "No clear catalyst" usually means noise; a cause sometimes surfaces later — absence of news is not a reason to act.',
    /** The floor footnote (CC6, D6): the Movers module shows liquid names only; the raw universe —
     * trusts, wrappers, structured products, thin ETFs — stays in the universe-wide Scans. */
    floorNote: "Liquid names only — the full universe stays in Scans.",
    /** RelVol saturates at the window length (a 20-day average that includes today cannot be beaten
     * by more than 20×), so a value at the ceiling reads "≥20×" rather than a canned "20.0×" (CC6). */
    relvolCapped: "≥20×",
  },

  calendar: {
    /** "No edge" is a first-class outcome with its own rendering, never an apology. */
    noEdge: "No clear edge either way — that is a valid outcome.",
    /** The word beside a high-importance row's dot — outcome never rides on colour alone. */
    importanceHigh: "high",
    /** The empty calendar is a signature, not a failure: the allowlist drops every non-catalyst FRED
     * release, so a genuinely quiet fortnight renders as one — and says why. */
    empty: "A quiet stretch — no scheduled catalysts in the next 14 days.",
    emptySub: "Curated from the full FRED release feed; the rest was noise.",
    /** M8 (app-feel): the cut is named — the reader is told what they are seeing and through when. */
    next: "Next {k} of {n} · through {date}",
    /** The label on the collapsed retrospective row (CC6, D7): today's already-reported earnings are
     * one line ("Reported today: JPM · BAC · GS · C · WFC"), not a stack that buries the week ahead. */
    reportedToday: "Reported today",
  },

  brief: {
    /** When the verification gate holds the briefing, this is what ships. It beats a guess. */
    unavailable: "Briefing unavailable tonight — scan results below are complete and verified.",
  },

  /**
   * The Front Page (NEWS-AND-CONTROL Part 7, Appendix B). The `ordering` string is NOT the plan's, and
   * the reason is the room's ethic: Appendix B promised a ranking by scope + corroboration + magnitude,
   * but on the real feed corroboration is 1 for 131/134 clusters and magnitude 0 for ~130 — 45% of the
   * weight sits near constant, so ten-plus stories tie and the lead is decided by publish time. The
   * honest fix was to change the WORDS not the ranking: the sentence now says the ties are there and
   * how they break. Inventing a tiebreaker would be the app forming an editorial opinion, which ruling
   * C1 forbids. (Q-N4-1; amendment logged.)
   */
  news: {
    roomTitle: "Front page",
    pressTime: "Assembled {date} {time} ET · from {articles} articles, {clusters} catalysts",
    ordering:
      "Ordered by significance: the kind of event (a hard catalyst outranks an opinion), how many separate outlets carried it, how large the company or index is, and how recent it is. Ties run newest first.",
    /** C10. The room is a newspaper: it has a press time, and it does not pretend to be a wire. */
    cadence: "Assembled nightly after the US close. This page does not update during the day.",
    countLine: "{n} catalysts{filters}",
    zeroState: "No {filter} catalysts today — that is information, not an error.",
    reset: "Clear filters",
    /** C9. It affects everything and names nothing — which is a fact about the story, not a gap. */
    noListing: "No direct listing in our universe.",
    /**
     * C9 at CARD scale (CC5). The full sentence above needs room to mean it and keeps it on the story
     * sheet; a card in a two-up grid has none, and eight identical sentences on one screen is noise.
     * So a macro story's ticker row prints this one mono word where the chips would sit — the same
     * fact, said at a glance.
     */
    marketWide: "Market-wide",
    noStoryHeader: "Moved without a story",
    sources: "{n} sources",
    oneSource: "1 source",
    photoVia: "Photo via {source}",
    /**
     * A story published before the app kept its article list (pre-N5). The count is real but the
     * articles were not saved, so it cannot be opened — the only honest move: an empty "Sources" list
     * would claim it had none, and hiding the section would hide that the claim is uncheckable.
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
     * The gate-dropped note, deliberately NOT rendered on the card (a null prints nothing — P9). It is
     * for the STORY page, where a reader who came for the "why" is owed the reason there is none:
     * silence on a card is restraint; on the page devoted to one story it would be a hole.
     */
    noteDropped:
      "No context line for this story: the one written failed the number check, so it was dropped rather than published unverified.",
    /** The narrator honestly had nothing to add. Different from the line above, and it says so. */
    noteAbsent: "No context line for this story.",

    // ── PD8: the story page v2 (plan 9.6) ───────────────────────────────────────────────────────
    /** Block 5 heading — the v2 context prose (mechanism + where the name sits tonight). */
    contextTonight: "Context tonight",
    /**
     * Block 5's absence, and WHICH absence: a context the gate DELETED speaks (the system working
     * loudly); a narrator with nothing to add prints nothing (working quietly). Only the deleted case
     * is worth a sentence.
     */
    contextDropped:
      "No context for this story: the added context cited a figure that traced back to no source, so the gate dropped it rather than publish it unverified.",
    /** Block 7 heading — our own ledger's evidence on the affected names. */
    theRecord: "What our record says",
    /** Block 8 heading — the dated road ahead. Facts with dates, never levels to watch (E4). */
    onTheCalendar: "On the calendar",
    /** A watch row: "{title} · {date} · {scope}". A market-wide event names no ticker. */
    watchMarketWide: "market-wide",
    /** The footer's `{model}` slot, composed from model_meta (9.5), never hardcoded — the template
     * already says "extracted by {model}". */
    provenanceModels: "{extract}, narrated by {synth}",
    /** A pre-PD7 row ran an extraction but did not record which model — we say so, not a guess. */
    provenanceEarlier: "an earlier run",
  },

  /**
   * The login wall. Even the marketing lines obey the one-deck rule and the mechanical voice — the
   * first page a reader sees is not the place to start over-promising.
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
   * The app-feel additions (APP-FEEL-PLAN Appendix B) — honesty rules in final human form, per above.
   * The watchlist's window statements (ruling C2, NEWS-AND-CONTROL Part 5.1): the sparkline was the
   * least honest thing on the Desk — a shape saying "up" over an unstated period, where a month and a
   * year draw the same picture and mean opposite things.
   */
  watchlist: {
    sparkCaption: "Sparklines: 30 sessions, close only",
  },

  /**
   * The control room (N6, plan Part 8 + Appendix B). THE "NOT AVAILABLE" SENTENCES ARE THE FEATURE.
   * Part 8.1 found that on a normal weeknight the pipeline has already run and a manual re-run would
   * recompute byte-identical data — so most of the time the honest control is the EXPLANATION, not a
   * button (ruling C5: an empty state is information). A present-but-pointless button invites a press
   * that changes nothing and says nothing about it, which is a lie about what you did.
   */
  control: {
    title: "Pipeline",

    runFull: "Run tonight's full pipeline",
    runFullDesc: "Ingest the close, recompute everything, publish.",
    runNews: "Refresh the news",
    /**
     * `{cost}` is a MEASURED number (NEWS_RUN_COST_USD), printed because this is the only button that
     * spends money. N5 made news mode run the narrator now (≤60 Haiku extracts + one Sonnet call):
     * "refresh the news" honestly means the whole page, facts and context lines together, not stories
     * rebuilt while their notes are silently blanked.
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
     * What the OTHER buttons say while a run is in flight (plan 8.4). The jobs share a GitHub
     * concurrency group (`msm-nightly`, serialized, cancel-in-progress false), and GitHub keeps only
     * the LATEST queued run — so a second dispatch might simply evaporate. The panel refuses it as a
     * STATE rather than let a press become a run that quietly never happened.
     */
    blocked: "waiting for the run already in flight",

    // The C5 explanations: each names the reason AND the next moment something changes — "not
    // available" without a "next" is a dead end.
    naMarketOpen:
      "Markets are open — today's closing data doesn't exist until 4:00 PM ET. The nightly run lands ~{nightly} ET.",
    naWeekend:
      "It's the weekend — {lastDay}'s close is the latest data that exists; nothing new lands before {nextDay} 4:00 PM ET.",
    naHoliday: "US markets are closed today ({name}) — {lastDay}'s close stands until {nextDay}.",
    naAlreadyRan: "Tonight's run already succeeded at {time} — there is nothing newer to fetch.",

    /** P-2 is not provisioned. The panel renders every real state against the missing secret and says
     * plainly what is missing — it does not hide or pretend to work. */
    notConfigured: "Manual runs need a GitHub token — see QUESTIONS-FOR-BISHANT (P-2).",

    /**
     * THE SENTENCE THAT STOPS A SILENT FAILURE. The dispatch API answers 204 with an empty body, so
     * the run id is recovered by matching the request id in the run's name — usually a second or two.
     * If it never resolves, the panel must not sit on "requested…" forever (a fired run and a
     * never-fired run would look identical); it says this and links the Actions tab.
     */
    lost: "Dispatched, but the run never appeared. It may still be starting — check the Actions tab.",
    failed: "That run failed.",
    viewRun: "View the run log →",

    history: "Recent manual runs",
    /** The empty history. Nothing has been run by hand — which is the normal, healthy state. */
    historyEmpty: "You haven't run anything by hand yet. The scheduled runs are doing their job.",

    /* ── CC7: the pipelines table (plan 4.6) ──────────────────────────────────────────────────────
     * The control room becomes a table of the Desk's three schedules; the manual modes are actions
     * inside each pipeline's sheet, not rows. One plain line of what each does — mechanical voice. */
    pipelines: {
      nightlyFull: {
        name: "Nightly full (Job A)",
        description: "Ingests the close, recomputes everything, and publishes the edition.",
      },
      dawnRefresh: {
        name: "Dawn refresh",
        description: "Re-reads the index closes FRED posts overnight, before the open.",
      },
      eveningBriefing: {
        name: "Evening briefing (Job B)",
        description: "Assembles the evening brief from the day's stored data.",
      },
    },

    /** The table's column headers. */
    col: {
      pipeline: "Pipeline",
      cadence: "Cadence",
      lastRun: "Last run",
      nextRun: "Next run",
      duration: "Duration",
    },

    /** The table itself, and the affordance that opens a row's depth sheet. */
    tableLabel: "Pipelines",
    openSheet: "Open {name} details",

    /** The detail sheet's sections (plan 4.6: what it fetches · stages · limits · run-now · recent). */
    sheet: {
      fetches: "What it fetches",
      fetchesEmpty: "Reads only from the data already stored — it fetches nothing.",
      stages: "Stages",
      limits: "Daily limits",
      perDay: "{n}/day",
      cooldownGap: "{min}-min gap",
      runByHand: "Run by hand",
      recentRuns: "Recent runs",
      /** M8: a list showing ten of an unknown number must state its cut. Shown only when it is at the cap. */
      recentRunsCapped: "Recent runs · last 10",
      recentEmpty: "No runs recorded yet.",
      /** The honest note under the dawn refresh's empty last-run — it shares the nightly's record today. */
      dawnShares: "The dawn refresh shares the nightly's run record for now; its own last-run appears once it runs on its own schedule.",
    },
  },

  /** The ticker's chart captions — what the bars ARE, and through when (C2). */
  ticker: {
    rangeCaption: "Daily bars · adjusted · through {date}",
    rangeCoverage: "Showing full history: {years}",
    rangeUnavailable: "Less than {min} of history for this symbol",
    lastCloseWindow: "1D vs prior close",

    // ── PD8: the page v2 (Part 10) ──────────────────────────────────────────────────────────────
    /** The 52-week strip's low/current/high labels — position, never angle (P13). */
    rangeLow: "Low",
    rangeHigh: "High",
    rangeCurrent: "Last close",
    /**
     * The strip's window line, stated HONESTLY at any history length: "52-week" is a claim about a
     * year, so fewer sessions get the plain "Trading range" wording and the true session count. Both
     * name the window out loud (§5.2, every number states its scope).
     */
    range52wWindow: "52-week range · {n} sessions · through {date}",
    rangeShortWindow: "Trading range · {n} sessions · through {date}",
    /** The identity line under the header: "NASDAQ · Technology" — each absent field simply omitted. */
    identitySeparator: " · ",
    /** The section headings for the new blocks (each names its absence state in the page). */
    mentionHeading: "Tonight's mention",
    recordHeading: "The record here",
    calendarHeading: "On the calendar",
    paperHeading: "Your paper position",
    /** Tonight's mention: the snapshot move's relative-volume clause, beside the story link. */
    mentionRvol: "on {rvol} relative volume",
    /** The calendar row: "MSFT earnings · Mon Jul 13" — a fact with a date, never a level to watch. */
    calendarConsensus: "cons. {consensus} · prior {prior}",
    /** The open position's mark: its window (C2), on the OutcomeChip beside the signed figure. */
    paperVsLastClose: "vs last close",
    paperRealizedHistory: "Realized here: {value} over {n} closed",
    paperNoLastClose: "No last close to mark against yet.",
    /** The provenance footer (block 8) — composed from what actually rendered (ruling C6). */
    provenanceBars: "Bars through {date}",
    provenanceLedger: "signals from the append-only ledger",
    /** The Rail's exit to the full page (10.2, logged non-change) — clearer for naming its symbol. */
    railFullView: "Full view: {sym} →",
  },

  /**
   * PD8 — "what our record says" for a name (plan 9.6 block 7 / 10.1 block 5). Shared by the story and
   * ticker pages, because the record is one thing and two definitions would drift.
   */
  record: {
    /** An open (fired, unresolved) signal — a claim the ledger is still holding. */
    openSignal: "Open signal",
    firedResolves: "Fired {fired} · resolves {resolves}",
    horizon: "{n}-session horizon",
    /** Resolved history — hits and misses at EQUAL weight, the insert-only truth (§1.5). */
    resolvedHere: "Resolved here",
    hitCount: "{n} hit",
    hitCountPlural: "{n} hits",
    missCount: "{n} miss",
    missCountPlural: "{n} misses",
    /** The setup card's pattern, shown read-only here — the interactive card stays on the Desk. */
    setupIntro: "The latest setup on this name",
  },

  scans: {
    /** Ruling M1, spoken — the sentence that separates a scan table from a leaderboard. One home:
     * under the table, as the DataTable's footnote. */
    tableNote:
      "Matches are filter hits, not forecasts. Sorting re-orders today’s matches; it never ranks tomorrow.",
    /** The name of the pipeline's own order. Never "top", never "best". */
    order: "scan order",
    /** M8: a preview states its rule. Never "highlights", never an unlabelled slice. */
    preview: "First {k} of {n} by scan order",
    allMatches: "All {n} matches →",
    /**
     * The 500-row cap, an honest editorial as much as a limit: a filter matching this many of ~6,000
     * names has stopped filtering. Sorting is disabled above it — sorting a silent subset would present
     * "biggest among the most salient" as "biggest", the unlabelled ranking ruling M1 kills.
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
    /** M2's contract: a collapsed summary must say HOW MUCH it hides and as of WHEN. A disclosure that
     * hides an unstated number of things can hide a miss. */
    more: "+ {n} more · {context}",
    calendar: "Full calendar",
    movers: "All movers",
    watchlist: "Full watchlist",
    sources: "Per-provider detail",
  },

  overlay: {
    /**
     * The detail sheet (PD9, plan 11.2). The ✕ is the sheet's first focusable control and plainest
     * exit, labelled like the rail's close so the two overlays speak alike; the reader also has Esc,
     * the scrim, an overscroll pull, and the back gesture.
     */
    close: "Close",
  },

  pulse: {
    /**
     * M8, for a shelf: the reader is told what is off-screen and how to reach it. THE MACRO PULSE NO
     * LONGER HAS A SHELF, and this key outlives that (PD4). Its siblings `marketsShelf`/`moneyShelf`
     * were DELETED with the Desk's swipe-shelves (amendment 0.2.1 — a count of what's off-edge is a lie
     * when nothing is). This one survives because the `Shelf` primitive does — the styleguide renders a
     * live specimen, and a primitive with no demo rots.
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
     * The date is load-bearing: a served bar can be days old around a holiday, and "last close" without
     * its date is an implicit freshness claim the reader cannot check. Disclaimer covers liveness; the
     * date covers age.
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
 * Substitutes {placeholders} in a copy-deck string. Strict both ways because a half-rendered guardrail
 * is worse than a crash: a missing value throws rather than leaving a literal "{n}" on screen, and an
 * extra value throws rather than being silently ignored (usually a renamed placeholder).
 *
 * @param template a string from the `copy` deck above — never a literal from a component
 * @param values   one entry per {placeholder}, no more and no fewer
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
