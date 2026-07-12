export const marketData = {
  indices: [
    { name: 'S&P 500', ticker: 'SPX', value: 5847.23, change: +18.42, changePct: +0.32 },
    { name: 'Nasdaq', ticker: 'NDX', value: 20914.55, change: -43.18, changePct: -0.21 },
    { name: '10Y Yield', ticker: 'TNX', value: 4.381, change: +0.024, changePct: +0.55, unit: '%' },
    { name: 'VIX', ticker: 'VIX', value: 14.82, change: -0.93, changePct: -5.91 },
    { name: 'Adv/Dec', ticker: 'BRDTH', value: '2,041 / 1,387', label: 'NYSE breadth', raw: 2041 / 1387 },
  ],
}

export const dailyBrief = {
  am: {
    label: 'Morning Plan — Fri Jul 11',
    items: [
      {
        heading: 'What happened',
        body: 'Futures flat after Thursday\'s 0.4% SPX rally on softer-than-expected initial jobless claims. Asian markets mixed; Nikkei +0.6%, Hang Seng -0.3%.',
      },
      {
        heading: 'Why it matters',
        body: 'Markets are pricing in two Fed cuts by year-end. Any CPI surprise next week could reprice that view quickly.',
      },
      {
        heading: 'By the numbers',
        body: 'SPX sits 1.2% below the June 13 all-time high. Breadth improved yesterday — 68% of NYSE stocks advanced. Put/call ratio at 0.82 (mild complacency).',
      },
      {
        heading: 'Yes, but',
        body: 'Volume was 14% below 30-day average — a light summer session. Don\'t read the move as conviction.',
      },
    ],
  },
  pm: {
    label: 'Afternoon Scorecard — Thu Jul 10',
    items: [
      {
        heading: 'What happened',
        body: 'SPX +0.41%, NDX -0.19%. Tech underperformed as NVDA slid 2.1% on no news. Financials led on JPM earnings pre-announcement.',
      },
      {
        heading: 'Why it matters',
        body: 'Rotation from tech into financials and industrials is a recurring theme as the yield curve un-inverts.',
      },
      {
        heading: 'By the numbers',
        body: 'JPM +3.2%, GS +1.8%, BAC +2.1%. Mag 7 basket -0.9% for the session.',
      },
      {
        heading: 'Yes, but',
        body: 'One day\'s sector rotation doesn\'t confirm a trend. Financials outperformed 4 of the last 8 sessions, then gave it back.',
      },
    ],
  },
}

export const calendarEvents = [
  { date: 'Tue Jul 15', time: '8:30', label: 'CPI — June', type: 'macro', consensus: '+3.0% YoY', prior: '+3.3% YoY', importance: 'high' },
  { date: 'Wed Jul 16', time: '8:30', label: 'Retail Sales — June', type: 'macro', consensus: '+0.3% MoM', prior: '+0.1% MoM', importance: 'medium' },
  { date: 'Wed Jul 16', time: 'AMC', label: 'ASML Earnings', type: 'earnings', consensus: '€6.72 EPS', prior: '€5.97 EPS', importance: 'medium' },
  { date: 'Thu Jul 17', time: 'BMO', label: 'TSMC Earnings', type: 'earnings', consensus: 'NT$9.32 EPS', prior: 'NT$8.73 EPS', importance: 'high' },
  { date: 'Thu Jul 17', time: '8:30', label: 'Initial Claims', type: 'macro', consensus: '228K', prior: '222K', importance: 'medium' },
  { date: 'Fri Jul 18', time: '—', label: 'OPEX — July', type: 'options', consensus: '~$2.1T notional', prior: '', importance: 'high' },
  { date: 'Tue Jul 29', time: 'BMO', label: 'META Earnings', type: 'earnings', consensus: '$5.24 EPS', prior: '$4.71 EPS', importance: 'high' },
  { date: 'Tue Jul 29', time: 'AMC', label: 'MSFT Earnings', type: 'earnings', consensus: '$3.12 EPS', prior: '$2.94 EPS', importance: 'high' },
  { date: 'Wed Jul 30', time: '2:00', label: 'FOMC Decision', type: 'fomc', consensus: 'Hold 5.25–5.50%', prior: 'Hold 5.25–5.50%', importance: 'high' },
]

export const movers = [
  { ticker: 'CRWD', name: 'CrowdStrike', changePct: +11.4, relVol: 4.2, catalyst: 'Earnings beat: ARR +33% YoY', price: 368.50 },
  { ticker: 'TSLA', name: 'Tesla', changePct: -6.8, relVol: 2.1, catalyst: 'Delivery miss Q2: 422K vs 455K est.', price: 182.30 },
  { ticker: 'XOM', name: 'ExxonMobil', changePct: +2.3, relVol: 1.4, catalyst: 'Oil +2.1% on OPEC+ supply cut signal', price: 113.75 },
  { ticker: 'SNAP', name: 'Snap Inc.', changePct: -4.1, relVol: 1.8, catalyst: 'Analyst downgrade: Bernstein → Underperform', price: 11.24 },
  { ticker: 'PLTR', name: 'Palantir', changePct: +3.7, relVol: 1.6, catalyst: 'No clear reason — likely noise', price: 31.80, noisy: true },
  { ticker: 'TGT', name: 'Target', changePct: -1.9, relVol: 0.9, catalyst: 'Weak consumer confidence data', price: 134.60 },
]

// Sparkline data (7-day mini history)
const mkSpark = (base: number, dir: 1 | -1) =>
  Array.from({ length: 14 }, (_, i) => ({
    v: base + dir * i * 0.8 + (Math.random() - 0.5) * base * 0.02,
  }))

export const watchlist = [
  { ticker: 'NVDA', name: 'Nvidia', price: 138.42, changePct: -1.23, spark: mkSpark(145, -1) },
  { ticker: 'AAPL', name: 'Apple', price: 224.18, changePct: +0.48, spark: mkSpark(220, 1) },
  { ticker: 'MSFT', name: 'Microsoft', price: 466.30, changePct: +0.89, spark: mkSpark(460, 1) },
]

export const setupCards = [
  {
    id: 'nvda-vol-contraction',
    ticker: 'NVDA',
    name: 'Nvidia Corp.',
    pattern: 'Volume contraction at prior high',
    tier: 'moderate',
    tierNote: 'Base rate ≥ 55%, sample n ≥ 80',
    whatFired: [
      'Volume declined 38% below 20-day avg for 3 consecutive sessions',
      'Price consolidating within 1.8% of the June 20 high ($142.10)',
      'RSI(14) at 52 — neither overbought nor oversold',
      'ATR(14) compressed to 2.9% of price — lowest in 60 days',
    ],
    baseRate: { higher: 61, total: 108, pct: 56.5, ciLow: 47, ciHigh: 65, days: 10 },
    typicalRange: { low: -5.8, high: +9.2, unit: '%', note: '10-day fwd return, 25th–75th pct' },
    weakenedBy: [
      'Volume expands back above average on a down session',
      'NDX breaks below 20,500 (index headwind)',
      'VIX spikes above 20 before the setup resolves',
      'Earnings within 10 calendar days (NVDA reports Aug 28)',
    ],
    dotArray: { hits: 61, total: 108 },
  },
  {
    id: 'aapl-inside-week',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    pattern: 'Inside week into support',
    tier: 'weak',
    tierNote: 'Base rate < 55% or sample n < 60',
    whatFired: [
      'This week\'s range entirely inside last week\'s high/low ($219.40–$228.80)',
      'Sitting on the rising 20-week moving average ($221.50)',
      'Relative strength vs. SPX flat — not lagging, not leading',
    ],
    baseRate: { higher: 44, total: 97, pct: 45.4, ciLow: 36, ciHigh: 55, days: 5 },
    typicalRange: { low: -3.2, high: +4.8, unit: '%', note: '5-day fwd return, 25th–75th pct' },
    weakenedBy: [
      'Close below the 20-week MA this week ($221.50)',
      'Market-wide risk-off ahead of CPI on Jul 15',
      'Options market pricing >3% move (IV diverging from HV)',
    ],
    dotArray: { hits: 44, total: 97 },
  },
]

export const trackRecord = {
  stats: { totalCalls: 84, resolved: 84, hits: 51, hitRate: 60.7, avgDays: 8.3 },
  byTier: [
    { tier: 'strong', calls: 12, hits: 9, hitRate: 75.0 },
    { tier: 'moderate', calls: 38, hits: 24, hitRate: 63.2 },
    { tier: 'weak', calls: 34, hits: 18, hitRate: 52.9 },
  ],
  calls: [
    { date: 'Jul 9', ticker: 'META', pattern: 'Breakout from 6-week base', tier: 'moderate', outcome: 'hit', fwdReturn: +6.2, baseRatePct: 59 },
    { date: 'Jul 5', ticker: 'AMZN', pattern: 'Volume contraction at high', tier: 'moderate', outcome: 'miss', fwdReturn: -2.8, baseRatePct: 57 },
    { date: 'Jul 3', ticker: 'GS', pattern: 'Inside week into support', tier: 'weak', outcome: 'hit', fwdReturn: +3.1, baseRatePct: 48 },
    { date: 'Jul 1', ticker: 'NVDA', pattern: 'Post-earnings drift up', tier: 'strong', outcome: 'hit', fwdReturn: +9.4, baseRatePct: 73 },
    { date: 'Jun 27', ticker: 'TSLA', pattern: 'Mean reversion after gap-down', tier: 'weak', outcome: 'miss', fwdReturn: -4.7, baseRatePct: 44 },
    { date: 'Jun 25', ticker: 'MSFT', pattern: 'Tight weekly close cluster', tier: 'moderate', outcome: 'hit', fwdReturn: +2.9, baseRatePct: 56 },
    { date: 'Jun 20', ticker: 'SPY', pattern: '5-day inside range breakout', tier: 'strong', outcome: 'hit', fwdReturn: +1.8, baseRatePct: 71 },
    { date: 'Jun 17', ticker: 'CRWD', pattern: 'Volume surge on base breakout', tier: 'strong', outcome: 'hit', fwdReturn: +14.2, baseRatePct: 76 },
    { date: 'Jun 14', ticker: 'AAPL', pattern: 'Pullback to rising 50-day MA', tier: 'moderate', outcome: 'miss', fwdReturn: -1.4, baseRatePct: 61 },
    { date: 'Jun 10', ticker: 'AMD', pattern: 'Volatility compression setup', tier: 'weak', outcome: 'miss', fwdReturn: -3.2, baseRatePct: 46 },
    { date: 'Jun 6', ticker: 'JPM', pattern: 'Earnings drift (beat + guide)', tier: 'strong', outcome: 'hit', fwdReturn: +5.8, baseRatePct: 74 },
    { date: 'Jun 3', ticker: 'GOOG', pattern: 'Inside week into support', tier: 'weak', outcome: 'hit', fwdReturn: +2.2, baseRatePct: 49 },
  ],
}

export const academyLessons = [
  {
    id: 'base-rates',
    title: 'What is a base rate, and why does it matter?',
    category: 'Foundations',
    readTime: 5,
    body: `When you hear "this stock pattern works," the natural question is: compared to what, over how many occurrences?

A **base rate** is the historical frequency of an outcome in a well-defined set of similar situations. If a pattern fired 110 times in the past five years and the stock was higher 10 days later in 62 of those cases, the base rate is 62/110 = 56%.

Why does this matter? Because human intuition is terrible at estimating frequencies. We remember the vivid wins and forget the quiet losses. Base rates force the question into numbers, where it belongs.

**The sample size problem.** A base rate of 8/10 = 80% sounds amazing. A base rate of 80/100 = 80% is far more meaningful — and in practice the confidence intervals around small samples overlap almost everything. This is why every setup card on this desk shows both the percentage and the sample size (n). A 70% base rate from 15 examples is nearly meaningless. From 150 examples, it's informative.

**Confidence intervals.** Because we're sampling from a population of possible similar setups, our estimate of the true base rate has uncertainty. A 95% confidence interval of 47%–65% means: with the data we have, the true long-run rate is plausibly anywhere in that range. The interval widens with smaller samples and narrows with larger ones.

**The honest bottom line.** Even a strong base rate from a large sample is not a prediction. Markets are non-stationary — patterns that worked in 2018–2023 may behave differently going forward. Base rates are one lens, not a crystal ball.`,
  },
  {
    id: 'relative-volume',
    title: 'Relative volume: what it tells you and what it doesn\'t',
    category: 'Market Structure',
    readTime: 4,
    body: `Relative volume (RelVol or RVOL) compares today's trading volume to the average for that time of day or that session. A stock trading at 3× its average volume is getting unusual attention. But attention isn't direction.

**What high volume confirms:** conviction. If a stock breaks above a resistance level on 4× average volume, more participants agree with the move than usual. That doesn't mean the move continues — it means the break was not a fluke of thin trading.

**What high volume doesn't tell you:** whether the participants are right. Volume is the engine, not the steering wheel. A stock can gap up on enormous volume and immediately reverse — institutional traders call this "selling into demand."

**Volume contraction.** When a stock consolidates near highs on shrinking volume, it often means sellers are not motivated — they're comfortable holding. This is the logic behind the volume-contraction setups on this desk. The absence of selling volume near a resistance level is loosely bullish, not strongly bullish.

**The practical rule.** Volume is most useful as a confirming signal, not a leading one. Read price first, then ask whether volume confirms or contradicts. A big move on thin volume deserves skepticism. A breakout on 2–3× volume has more credibility than the same move on flat volume.`,
  },
  {
    id: 'inside-week',
    title: 'Inside weeks: compression before expansion',
    category: 'Patterns',
    readTime: 3,
    body: `An inside week occurs when the current week's high is lower than the prior week's high, and the current week's low is higher than the prior week's low. The whole week fits inside the prior week's range.

This is a pattern of **volatility compression**. The market is indecisive — neither buyers nor sellers are willing to push beyond the previous week's boundaries. Compression tends to precede expansion, but it does not predict direction.

**The setup.** When an inside week occurs at a logical support level — a rising moving average, a prior breakout level, a round number — it gains additional context. The support level is being tested quietly. If it holds and price expands upward on the following week, that's the base rate scenario in the dataset.

**Why it fails.** Inside weeks also precede breakdowns. If the market is weak and the inside week is actually distribution (large holders reducing positions quietly), the expansion will be to the downside. This is why the "what would weaken this" checklist matters — you're looking for signs that the inside week is absorption, not accumulation.

**Calibration.** Across the dataset on this desk, inside weeks at support resolve higher about 45–50% of the time — essentially a coin flip. The edge, if any, comes from combining the pattern with confirming signals (sector strength, low implied volatility, nearby earnings cleared). This desk rates unconfirmed inside weeks as **weak tier**.`,
  },
  {
    id: 'vix-breadth',
    title: 'VIX and market breadth: reading the room',
    category: 'Market Structure',
    readTime: 4,
    body: `Two numbers that tell you more than price alone: the VIX and market breadth.

**The VIX.** The CBOE Volatility Index measures the market's expectation of 30-day future volatility for the S&P 500, derived from options prices. A higher VIX means options traders are paying more for protection — they're more uncertain or more scared. A lower VIX means the opposite.

Critically, the VIX is a measure of **expected** volatility, not actual volatility. It often leads actual volatility by days or weeks. VIX above 25 has historically been associated with increased odds of a market bottom (fear peaks before prices do). VIX below 12 has been associated with complacency that often precedes correction.

**What VIX doesn't tell you:** direction. A high VIX is consistent with both continued decline and a sharp reversal. Use it as a risk gauge, not a signal.

**Market breadth.** Breadth measures how many stocks are participating in a market move. The advance/decline ratio (A/D) compares the number of stocks that rose to the number that fell. A broad rally — SPX up 1% with 70% of stocks advancing — is more durable than a narrow rally driven by five mega-cap names.

Breadth divergence is the key warning: when SPX makes a new high but fewer and fewer stocks are participating, the rally is becoming fragile. The same logic applies to the downside.

**The morning briefing context.** This desk shows both numbers every morning not as signals but as atmosphere — they set the risk context for reading individual setups.`,
  },
]
