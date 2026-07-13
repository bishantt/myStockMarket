/**
 * The seeded news night — 14 catalysts for the Front Page (NEWS-AND-CONTROL-PLAN Part 7.10).
 *
 * THE ONE THING THIS FIXTURE EXISTS TO PROVE. The biggest mover does not lead the front page.
 * SMCI rose 18.4% — the largest move on the seeded tape — and it ranks THIRD. The lead is a Fed
 * statement that moved nothing at all. That is not a quirk of the data; it is the whole editorial
 * claim of the room, and if a future change ever lets the big number float to the top, the e2e
 * that asserts this ordering goes red. A feed ranked by size of move is a leaderboard. This is a
 * newspaper (ruling C1).
 *
 * SIGNIFICANCE IS COMPUTED, NOT ASSIGNED. Every score below comes from Appendix E's formula:
 *
 *     significance = 0.30·scope + 0.25·corroboration + 0.20·magnitude + 0.15·class_prior
 *                    + 0.10·recency
 *
 *     scope         index/Fed/macro-wide 1.0 · sector-wide (≥3 tickers) 0.6 · single-name 0.3
 *     corroboration min(sources, 5) / 5
 *     magnitude     mean over linked tickers of min(|ret1| / ATR14%, 3) / 3   (0 with no tickers)
 *     class_prior   ma/fda/fed-macro 1.0 · earnings/guidance 0.8 · filing/legal 0.6 ·
 *                   analyst 0.4 · product/other 0.3
 *     recency       same session 1.0 · prior session 0.5 · older 0.25
 *
 * Each cluster below shows its arithmetic in a comment. The numbers were worked out by hand on
 * purpose: when the pipeline's rank.py lands (N4), it has an oracle a human can check it against,
 * rather than a set of magic constants that agree with themselves.
 *
 * Note what is NOT in this file, anywhere: clicks, views, popularity, "most read". The pipeline
 * does not ingest attention data at all, and that absence is the deepest guard the room has.
 */

/** The seeded run date — the same synthetic Thursday the rest of the seed uses. */
const RUN_DATE = new Date("2026-07-09T00:00:00.000Z");

/** Published times on the seeded evening. */
const t = (hhmm) => new Date(`2026-07-09T${hhmm}:00.000Z`);
/** ...and the session before it, for the two clusters that carry a recency decay. */
const yesterday = (hhmm) => new Date(`2026-07-08T${hhmm}:00.000Z`);

/**
 * The three cached article images.
 *
 * They are GENERATED, not stock photos — see prisma/fixtures/img note in the seed. A generated
 * image carries no licence question into the repo and is byte-identical on every machine, which is
 * what the visual-regression baselines need. In production these rows point at our R2 media bucket;
 * in the seed they point at /fixtures/news/, which Next serves straight out of public/.
 *
 * Every row carries width, height, and a blur placeholder. That is not decoration: it is what makes
 * the layout shift zero. A card that knows its image's shape before the image arrives never jumps.
 */
export const NEWS_IMAGES = [
  {
    id: "img-fed-decision",
    sourceKind: "provider",
    urlFull: "/fixtures/news/fed-decision.jpg",
    urlCard: "/fixtures/news/fed-decision.jpg",
    urlThumb: "/fixtures/news/fed-decision.jpg",
    width: 1200,
    height: 628,
    blurDataUrl:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAEAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCX7DBj7lFFFch1H//Z",
    dominantColor: "#8f6a44",
    attributionSource: "Reuters",
    attributionUrl: "https://reuters.com/fed-holds-july",
    fetchedAt: t("22:00"),
  },
  {
    id: "img-fda-approval",
    sourceKind: "provider",
    urlFull: "/fixtures/news/fda-approval.jpg",
    urlCard: "/fixtures/news/fda-approval.jpg",
    urlThumb: "/fixtures/news/fda-approval.jpg",
    width: 1200,
    height: 628,
    blurDataUrl:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAEAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCX7DBj7lFFFI5z/9k=",
    dominantColor: "#4f8f74",
    attributionSource: "Associated Press",
    attributionUrl: "https://apnews.com/fda-nonopioid-approval",
    fetchedAt: t("22:00"),
  },
  {
    id: "img-chip-merger",
    sourceKind: "og",
    urlFull: "/fixtures/news/chip-merger.jpg",
    urlCard: "/fixtures/news/chip-merger.jpg",
    urlThumb: "/fixtures/news/chip-merger.jpg",
    width: 1200,
    height: 628,
    blurDataUrl:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAEAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBv2G3x9yiiiu4yP//Z",
    dominantColor: "#4a5aa8",
    attributionSource: "Bloomberg",
    attributionUrl: "https://bloomberg.com/amd-acquisition",
    fetchedAt: t("22:00"),
  },
];

/**
 * The 14 clusters, in the order the Front Page must render them (significance, descending).
 *
 * `whyItMatters` is the verified one-liner. ONE cluster (JPM earnings) carries null on purpose:
 * its narrative line failed the verification gate, so the facts publish and the prose is dropped —
 * never softened, never replaced with a placeholder. That is P9 rendered as data, and the e2e
 * asserts the card shows its numbers and simply says nothing where the sentence would have been.
 */
export const NEWS_CLUSTERS = [
  {
    // RANK 1 — THE LEAD. A Fed statement, zero tickers, zero price fireworks.
    //   scope 1.0 (macro-wide) · corrob 5/5 = 1.0 · magnitude 0 (no tickers) · class 1.0 · recency 1.0
    //   0.30(1.0) + 0.25(1.0) + 0.20(0) + 0.15(1.0) + 0.10(1.0) = 0.800
    // It leads because it is the most significant thing that happened, and significance is not
    // excitement. This card also carries the C9 "no direct listing" line: it affects everything and
    // names nothing.
    id: "nc-fed-hold",
    runDate: RUN_DATE,
    firstSeen: t("18:02"),
    headline: "Fed holds rates steady, signals patience on cuts",
    eventType: "macro",
    sectors: ["Broad market"],
    themes: [],
    tickers: [],
    significance: 0.8,
    sources: 5,
    whyItMatters:
      "The path of short-term rates sets the discount rate under every valuation on the board, which is why a statement that moves no single stock can still be the day's largest event.",
    affectedNote: "Rate-sensitive sectors — housing, banks, utilities — carry the mechanism.",
    extract: { summary: "The FOMC left the target range unchanged and repeated that it will wait for more data before easing.", key_numbers: [] },
    verification: { status: "ok", checked: 2, flags: [] },
    imageId: "img-fed-decision",
  },
  {
    // RANK 2 — an FDA approval, sector-wide (3 tickers).
    //   scope 0.6 · corrob 4/5 = 0.8 · class 1.0 · recency 1.0
    //   magnitude: MRNA 9.2/4.0 = 2.30 → 0.767 · LLY 2.1/1.8 = 1.17 → 0.389 · PFE 1.4/1.5 = 0.93 → 0.311
    //             mean = 0.489
    //   0.30(0.6) + 0.25(0.8) + 0.20(0.489) + 0.15(1.0) + 0.10(1.0) = 0.728
    id: "nc-fda-nonopioid",
    runDate: RUN_DATE,
    firstSeen: t("14:41"),
    headline: "FDA approves first non-opioid painkiller in a generation",
    eventType: "fda",
    sectors: ["Health care"],
    themes: [],
    tickers: ["MRNA", "LLY", "PFE"],
    significance: 0.728,
    sources: 4,
    whyItMatters:
      "An approval of this class usually re-prices the whole treatment segment rather than one ticker, because it changes what the standard of care is allowed to be.",
    affectedNote: "Pain-management franchises across large-cap pharma carry exposure.",
    extract: {
      summary: "The agency cleared a first-in-class non-opioid analgesic for moderate-to-severe acute pain.",
      key_numbers: [{ id: "kn-1", label: "trial participants", value: "2,100" }],
    },
    verification: { status: "ok", checked: 3, flags: [] },
    imageId: "img-fda-approval",
  },
  {
    // RANK 3 — THE BIGGEST MOVER ON THE TAPE (+18.4%), AND IT DOES NOT LEAD.
    //   scope 0.3 (single-name) · corrob 3/5 = 0.6 · class 0.8 (earnings) · recency 1.0
    //   magnitude: SMCI 18.4 / ATR14 6.5 = 2.83 → min(2.83,3)/3 = 0.943
    //   0.30(0.3) + 0.25(0.6) + 0.20(0.943) + 0.15(0.8) + 0.10(1.0) = 0.649
    // Read that against rank 1: the Fed moved nothing and scores 0.80; SMCI moved 18.4% and scores
    // 0.65. Magnitude is one input of five, and it enters in units of the stock's OWN volatility —
    // so an 18% day in a name that routinely swings 6.5% is a big move, not an extraordinary one.
    id: "nc-smci-earnings",
    runDate: RUN_DATE,
    firstSeen: t("20:15"),
    headline: "Super Micro beats on AI server demand, lifts full-year outlook",
    eventType: "earnings",
    sectors: ["Technology"],
    themes: ["AI"],
    tickers: ["SMCI"],
    significance: 0.649,
    sources: 3,
    whyItMatters:
      "Server orders are an early read on datacentre capital spending, which lands in the revenue of the chipmakers a quarter or two later.",
    affectedNote: null,
    extract: {
      summary: "Revenue rose 40% year over year and the company raised its full-year guidance.",
      key_numbers: [
        { id: "kn-2", label: "revenue growth", value: "40%" },
        { id: "kn-3", label: "shares", value: "+18.4%" },
      ],
    },
    verification: { status: "ok", checked: 4, flags: [] },
    imageId: null, // L4 — the generated catalyst card. A first-class outcome, not a failure (C4).
  },
  {
    // RANK 4 — M&A.
    //   scope 0.3 (2 tickers — under the 3 that makes it sector-wide) · corrob 5/5 = 1.0 ·
    //   class 1.0 (ma) · recency 1.0
    //   magnitude: AMD 3.3/3.5 = 0.94 → 0.314 · NVDA 1.3/3.2 = 0.41 → 0.135 · mean = 0.225
    //   0.30(0.3) + 0.25(1.0) + 0.20(0.225) + 0.15(1.0) + 0.10(1.0) = 0.635
    id: "nc-amd-acquisition",
    runDate: RUN_DATE,
    firstSeen: t("12:05"),
    headline: "AMD to acquire networking-chip designer in $12B deal",
    eventType: "ma",
    sectors: ["Technology"],
    themes: ["AI"],
    tickers: ["AMD", "NVDA"],
    significance: 0.635,
    sources: 5,
    whyItMatters:
      "Buying the interconnect rather than building it is how a chipmaker shortens the gap to a rival's rack-scale product.",
    affectedNote: "Accelerator competitors carry second-order exposure.",
    extract: {
      summary: "AMD agreed to buy a networking-silicon designer for $12 billion in cash and stock.",
      key_numbers: [{ id: "kn-4", label: "deal value", value: "$12B" }],
    },
    verification: { status: "ok", checked: 3, flags: [] },
    imageId: "img-chip-merger",
  },
  {
    // RANK 5 — THE GATE-DROPPED NARRATIVE. Facts publish; the prose does not.
    //   scope 0.3 · corrob 4/5 = 0.8 · magnitude: JPM 2.4/2.0 = 1.20 → 0.400 · class 0.8 · recency 1.0
    //   0.30(0.3) + 0.25(0.8) + 0.20(0.400) + 0.15(0.8) + 0.10(1.0) = 0.590
    // The model's why-it-matters line cited a net-interest-margin figure that appears nowhere in the
    // extracts, so the deterministic gate dropped it. `whyItMatters` is null and the card renders
    // without that line — no placeholder, no apology, no softened version. An unverified number
    // never reaches the page (P9), and this row is the seeded proof of it.
    id: "nc-jpm-earnings",
    runDate: RUN_DATE,
    firstSeen: t("11:32"),
    headline: "JPMorgan tops estimates as loan losses stay contained",
    eventType: "earnings",
    sectors: ["Financials"],
    themes: [],
    tickers: ["JPM"],
    significance: 0.59,
    sources: 4,
    whyItMatters: null,
    affectedNote: null,
    extract: {
      summary: "The bank reported higher-than-expected profit and said credit costs remained stable.",
      key_numbers: [{ id: "kn-5", label: "shares", value: "+2.4%" }],
    },
    verification: {
      status: "dropped",
      checked: 3,
      flags: ["why_it_matters cited a net-interest-margin figure absent from the source extracts"],
    },
    imageId: null, // L4
  },
  {
    // RANK 6 — guidance cut.
    //   scope 0.3 · corrob 3/5 = 0.6 · magnitude: TSLA 4.7/4.2 = 1.12 → 0.373 · class 0.8 · recency 1.0
    //   0.30(0.3) + 0.25(0.6) + 0.20(0.373) + 0.15(0.8) + 0.10(1.0) = 0.535
    id: "nc-tsla-guidance",
    runDate: RUN_DATE,
    firstSeen: t("13:20"),
    headline: "Tesla trims delivery outlook, citing softer European demand",
    eventType: "guidance",
    sectors: ["Consumer discretionary"],
    themes: [],
    tickers: ["TSLA"],
    significance: 0.535,
    sources: 3,
    whyItMatters:
      "A delivery guide is the closest thing an automaker publishes to a forward revenue number, so cutting it re-bases every estimate below it.",
    affectedNote: null,
    extract: { summary: "The company lowered its full-year delivery target.", key_numbers: [{ id: "kn-6", label: "shares", value: "-4.7%" }] },
    verification: { status: "ok", checked: 2, flags: [] },
    imageId: null, // L4
  },
  {
    // RANK 7 — legal.
    //   scope 0.3 · corrob 3/5 = 0.6 · magnitude: COIN 8.8/6.8 = 1.29 → 0.431 · class 0.6 · recency 1.0
    //   0.30(0.3) + 0.25(0.6) + 0.20(0.431) + 0.15(0.6) + 0.10(1.0) = 0.516
    id: "nc-coin-ruling",
    runDate: RUN_DATE,
    firstSeen: t("15:48"),
    headline: "Court rules for Coinbase in registration dispute",
    eventType: "legal",
    sectors: ["Financials"],
    themes: [],
    tickers: ["COIN"],
    significance: 0.516,
    sources: 3,
    whyItMatters:
      "A registration ruling sets the compliance cost for every venue that lists the same assets, not only the defendant.",
    affectedNote: null,
    extract: { summary: "A federal court ruled the exchange's listings did not require securities registration.", key_numbers: [] },
    verification: { status: "ok", checked: 2, flags: [] },
    imageId: null, // L4
  },
  {
    // RANK 8 — PRIOR SESSION (recency 0.5). Still on the page; ranked below today's news for it.
    //   scope 0.3 · corrob 4/5 = 0.8 · magnitude: NVDA 1.3/3.2 = 0.41 → 0.135 · class 0.8 · recency 0.5
    //   0.30(0.3) + 0.25(0.8) + 0.20(0.135) + 0.15(0.8) + 0.10(0.5) = 0.487
    id: "nc-nvda-guidance",
    runDate: RUN_DATE,
    firstSeen: yesterday("21:10"),
    headline: "Nvidia guides above consensus on datacentre orders",
    eventType: "guidance",
    sectors: ["Technology"],
    themes: ["AI"],
    tickers: ["NVDA"],
    significance: 0.487,
    sources: 4,
    whyItMatters:
      "Datacentre guidance from the largest supplier is the sector's demand signal; the rest of the chain is priced against it.",
    affectedNote: null,
    extract: { summary: "The company guided next-quarter revenue above analyst consensus.", key_numbers: [] },
    verification: { status: "ok", checked: 2, flags: [] },
    imageId: null, // L4
  },
  {
    // RANK 9 — analyst note.
    //   scope 0.3 · corrob 3/5 = 0.6 · magnitude: AAPL 2.1/2.2 = 0.95 → 0.318 · class 0.4 · recency 1.0
    //   0.30(0.3) + 0.25(0.6) + 0.20(0.318) + 0.15(0.4) + 0.10(1.0) = 0.464
    id: "nc-aapl-note",
    runDate: RUN_DATE,
    firstSeen: t("09:55"),
    headline: "Analyst lifts Apple target ahead of next week's earnings",
    eventType: "analyst",
    sectors: ["Technology"],
    themes: [],
    tickers: ["AAPL"],
    significance: 0.464,
    sources: 3,
    whyItMatters:
      "An analyst note changes an opinion, not a business — which is why this class of catalyst carries the lowest prior in the ranking.",
    affectedNote: null,
    extract: { summary: "A sell-side analyst raised the price target citing services growth.", key_numbers: [] },
    verification: { status: "ok", checked: 1, flags: [] },
    imageId: null, // L4
  },
  {
    // RANK 10 — the downgrade behind GME's -9.2% day. THE L3 CASE: no photo, but the publisher's
    // identity card renders (favicon + source, composed onto a designed background).
    //   scope 0.3 · corrob 2/5 = 0.4 · magnitude: GME 9.2/7.5 = 1.23 → 0.409 · class 0.4 · recency 1.0
    //   0.30(0.3) + 0.25(0.4) + 0.20(0.409) + 0.15(0.4) + 0.10(1.0) = 0.432
    id: "nc-gme-downgrade",
    runDate: RUN_DATE,
    firstSeen: t("11:30"),
    headline: "Analyst downgrades GameStop to Sell on weak fundamentals",
    eventType: "analyst",
    sectors: ["Consumer discretionary"],
    themes: [],
    tickers: ["GME"],
    significance: 0.432,
    sources: 2,
    whyItMatters:
      "The move came on a rating change rather than a change in the business, which is the distinction this page exists to keep visible.",
    affectedNote: null,
    extract: { summary: "The firm cut its rating to Sell and reduced its price target.", key_numbers: [{ id: "kn-7", label: "shares", value: "-9.2%" }] },
    verification: { status: "ok", checked: 2, flags: [] },
    imageId: null, // L3 — resolved by the component from the source domain, not from a stored row.
  },
  {
    // RANK 11 — a filing.
    //   scope 0.3 · corrob 2/5 = 0.4 · magnitude: XOM 1.1/1.6 = 0.69 → 0.229 · class 0.6 · recency 1.0
    //   0.30(0.3) + 0.25(0.4) + 0.20(0.229) + 0.15(0.6) + 0.10(1.0) = 0.426
    id: "nc-xom-filing",
    runDate: RUN_DATE,
    firstSeen: t("16:40"),
    headline: "Exxon discloses a $2.1B impairment in a quarterly filing",
    eventType: "filing",
    sectors: ["Energy"],
    themes: [],
    tickers: ["XOM"],
    significance: 0.426,
    sources: 2,
    whyItMatters:
      "An impairment is an accounting write-down of assets already owned; it moves reported earnings without moving cash.",
    affectedNote: null,
    extract: { summary: "The company recorded an impairment against certain upstream assets.", key_numbers: [{ id: "kn-8", label: "impairment", value: "$2.1B" }] },
    verification: { status: "ok", checked: 2, flags: [] },
    imageId: null, // L4
  },
  {
    // RANK 12 — the Defense theme.
    //   scope 0.3 · corrob 2/5 = 0.4 · magnitude: LMT 1.8/1.5 = 1.20 → 0.400 · class 0.3 · recency 1.0
    //   0.30(0.3) + 0.25(0.4) + 0.20(0.400) + 0.15(0.3) + 0.10(1.0) = 0.415
    id: "nc-lmt-contract",
    runDate: RUN_DATE,
    firstSeen: t("10:12"),
    headline: "Pentagon awards Lockheed a multi-year missile contract",
    eventType: "product",
    sectors: ["Industrials"],
    themes: ["Defense"],
    tickers: ["LMT"],
    significance: 0.415,
    sources: 2,
    whyItMatters:
      "A multi-year award converts a backlog line into scheduled revenue, which is why defense names re-rate on contracts rather than on quarters.",
    affectedNote: null,
    extract: { summary: "The award covers several production lots over five years.", key_numbers: [] },
    verification: { status: "ok", checked: 1, flags: [] },
    imageId: null, // L4
  },
  {
    // RANK 13 — a product launch (the lowest catalyst prior, and it shows).
    //   scope 0.3 · corrob 3/5 = 0.6 · magnitude: MSFT 0.6/1.9 = 0.32 → 0.105 · class 0.3 · recency 1.0
    //   0.30(0.3) + 0.25(0.6) + 0.20(0.105) + 0.15(0.3) + 0.10(1.0) = 0.406
    id: "nc-msft-copilot",
    runDate: RUN_DATE,
    firstSeen: t("08:30"),
    headline: "Microsoft opens its agent platform to third-party developers",
    eventType: "product",
    sectors: ["Technology"],
    themes: ["AI"],
    tickers: ["MSFT"],
    significance: 0.406,
    sources: 3,
    whyItMatters:
      "Platform access changes who can build on the stack; it rarely changes this quarter's revenue, and the ranking treats it accordingly.",
    affectedNote: null,
    extract: { summary: "The company published APIs for its agent runtime.", key_numbers: [] },
    verification: { status: "ok", checked: 1, flags: [] },
    imageId: null, // L4
  },
  {
    // RANK 14 — last, and correctly so.
    //   scope 0.3 · corrob 2/5 = 0.4 · magnitude: UBER 1.2/2.4 = 0.50 → 0.167 · class 0.3 · recency 1.0
    //   0.30(0.3) + 0.25(0.4) + 0.20(0.167) + 0.15(0.3) + 0.10(1.0) = 0.368
    id: "nc-uber-expansion",
    runDate: RUN_DATE,
    firstSeen: t("07:45"),
    headline: "Uber expands its freight brokerage into two new markets",
    eventType: "product",
    sectors: ["Industrials"],
    themes: [],
    tickers: ["UBER"],
    significance: 0.368,
    sources: 2,
    whyItMatters: null,
    affectedNote: null,
    extract: { summary: "The company launched freight operations in two additional metros.", key_numbers: [] },
    verification: { status: "ok", checked: 1, flags: [] },
    imageId: null, // L4
  },
];

/**
 * The per-ticker links, with each ticker's numbers SNAPSHOTTED at publish.
 *
 * The snapshot is the point. If the story page recomputed these from live tables, the feed's number
 * and the card's number could disagree within one night — the same fact, two values. Freezing them
 * here means the front page and the story always tell the reader the same thing.
 *
 * `hasSetupCard` gates the "Setup card" doorway. Only SMCI has one in this seed, so only SMCI's row
 * offers the link: a doorway to evidence that does not exist is worse than no doorway at all.
 */
export const CATALYST_LINKS = [
  // FDA — the three pharma names (added to the seed's instruments for this cluster).
  { clusterId: "nc-fda-nonopioid", symbol: "MRNA", ret1: 0.092, rvol20: 3.4, hasSetupCard: false },
  { clusterId: "nc-fda-nonopioid", symbol: "LLY", ret1: 0.021, rvol20: 1.6, hasSetupCard: false },
  { clusterId: "nc-fda-nonopioid", symbol: "PFE", ret1: 0.014, rvol20: 1.3, hasSetupCard: false },
  // SMCI — the biggest mover, and the one name with evidence behind it.
  { clusterId: "nc-smci-earnings", symbol: "SMCI", ret1: 0.184, rvol20: 4.7, hasSetupCard: true },
  // The chip deal.
  { clusterId: "nc-amd-acquisition", symbol: "AMD", ret1: 0.033, rvol20: 2.68, hasSetupCard: false },
  { clusterId: "nc-amd-acquisition", symbol: "NVDA", ret1: -0.013, rvol20: 1.2, hasSetupCard: false },
  // The rest, one ticker each.
  { clusterId: "nc-jpm-earnings", symbol: "JPM", ret1: 0.024, rvol20: 1.9, hasSetupCard: false },
  { clusterId: "nc-tsla-guidance", symbol: "TSLA", ret1: -0.047, rvol20: 2.74, hasSetupCard: false },
  { clusterId: "nc-coin-ruling", symbol: "COIN", ret1: 0.088, rvol20: 2.71, hasSetupCard: false },
  { clusterId: "nc-nvda-guidance", symbol: "NVDA", ret1: -0.013, rvol20: 1.2, hasSetupCard: false },
  { clusterId: "nc-aapl-note", symbol: "AAPL", ret1: 0.021, rvol20: 2.4, hasSetupCard: false },
  { clusterId: "nc-gme-downgrade", symbol: "GME", ret1: -0.092, rvol20: 3.3, hasSetupCard: false },
  { clusterId: "nc-xom-filing", symbol: "XOM", ret1: 0.011, rvol20: 1.1, hasSetupCard: false },
  { clusterId: "nc-lmt-contract", symbol: "LMT", ret1: 0.018, rvol20: 1.4, hasSetupCard: false },
  { clusterId: "nc-msft-copilot", symbol: "MSFT", ret1: 0.006, rvol20: 1.2, hasSetupCard: false },
  { clusterId: "nc-uber-expansion", symbol: "UBER", ret1: 0.012, rvol20: 1.3, hasSetupCard: false },
];

/**
 * Instruments the news night introduces — the pharma names the FDA cluster affects, and Lockheed
 * for the Defense theme. Everything else it links to already exists in the seed.
 */
export const NEWS_INSTRUMENTS = [
  { symbol: "MRNA", name: "Moderna, Inc.", exchange: "NASDAQ", sector: "Health Care" },
  { symbol: "LLY", name: "Eli Lilly and Company", exchange: "NYSE", sector: "Health Care" },
  { symbol: "PFE", name: "Pfizer Inc.", exchange: "NYSE", sector: "Health Care" },
  { symbol: "LMT", name: "Lockheed Martin Corporation", exchange: "NYSE", sector: "Industrials" },
];

/**
 * THE MOVERS WITH NO STORY (ruling C9).
 *
 * PLTR (+6.1%), MARA (-12.1%) and AFRM (+5.2%) are among the Desk's eight movers and appear in NO
 * cluster. That is deliberate, and it is the hardest lesson the room teaches: most large moves have
 * no identifiable cause. They render in their own quiet slot, after the catalysts, never ranked
 * among them, each carrying the standing noise line.
 *
 * Nothing needs seeding for this — the absence IS the fixture. It is written down here so that a
 * future change which "helpfully" invents catalysts for them is recognised as the regression it is.
 */
export const NO_STORY_MOVERS = ["PLTR", "MARA", "AFRM"];
