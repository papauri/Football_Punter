# Model accuracy: what is measured, and what the model actually knows

This document exists because the dashboard used to report numbers that were not measured, and
because the model was widely believed to analyse inputs it does not have. Both are covered below,
with the commands to reproduce every figure.

> **Read this first.** Every historical figure below is *development* output. The most recent 9,000
> fixtures have been inspected and changed against repeatedly — strengths fitted, hyperparameters
> chosen, xG accepted, two league bugs found, the walk-forward reviewed — so they can no longer serve
> as a final exam. The model is now frozen (`npm run freeze`) and the only measurement that supports
> a claim about future performance is `npm run forward`, which scores fixtures that did not exist when
> the model was written. See **Retiring the historical window**.

## Corrections from the review of 27 September 2026

A line-by-line review of everything added in this pass found the following. Each is fixed in code,
and every figure below has been re-measured after the fixes. Where a number changed, the old one is
noted so nothing is silently rewritten.

1. **Every ROI confidence interval previously reported was invalid.** The bootstrap used an inline
   generator, `seed * 1103515245 + 12345`, whose product exceeds 2^53 in JavaScript, so it cycled
   every 10,466 draws while each bootstrap needed 7.1 million. The resamples were near-copies of one
   another; intervals were neither centred nor the right width. Among the casualties: the claim that
   ROI at best price had an interval "including zero". `src/model/bootstrap.js` now uses mulberry32
   and was checked against a simulation with known ROI.
2. **"Where the money actually is" used the closing line to pick the favourite, then priced it at
   open.** That is hindsight. Choosing the favourite from the price being tested, best-of-books at
   open moves from −0.31% to **−2.10%**, and Pinnacle at open from −1.28% to **−3.19%**.
3. **The engine rewrites its own hyperparameters.** A five-minute training cycle nudges home
   advantage and the draw setting, and two "autonomous patch" routines rewrite `hyperparameters.json`.
   A background cycle had done exactly that before the first honest-backtest commit: the shipped
   values were home advantage **1.297** and Dixon-Coles rho **−0.13**, not the 1.30 and −0.05 that
   were chosen and stated. Every figure in this document was measured with the shipped values, so the
   figures stand; the stated settings were wrong. All self-modification is now suspended while
   `data/model-freeze.json` exists, and the settings API refuses changes with a clear message.
4. **The strength fit did not converge.** League base rates were set once, from the average of home
   and away goals, and applied as the away rate, so both expected rates were inflated by about
   (1 + home advantage) / 2 and the normalisation fought the data every pass. On synthetic data with
   known strengths it oscillated. It is now a coordinate ascent that re-estimates each league's base
   and home advantage inside the loop: it converges in four passes on synthetic data and recovers true
   attack strengths better (r = 0.902 against 0.871). On real fixtures it is predictively neutral —
   paired differences in hit rate and Brier sit inside their intervals, and only 10 of 3,000 validation
   picks change — so it was kept because it is the correct estimator, not because it scores better.
5. **League tiers had two disagreeing sources.** The engine carried a private copy of the tier table
   that disagreed with `src/utils/leagueUtils.js` on over 30 leagues and matched substrings in both
   directions, so the Championship (a substring of "UEFA European Championship") was badged Tier 1
   and the Premier League (a substring of "Welsh Premier League") Tier 3. The engine attaches its tier
   to every match and the UI prefers it, so those were the badges users saw. `isLeagueSolid` had the
   same flaw: Austrian Bundesliga was treated as the German one, CAF and AFC Champions League as the
   UEFA one. One table now, exact matching only.
6. **Closing-line value discarded stable lines.** An unchanged price was never re-recorded, so a line
   that settled hours before kickoff kept its first timestamp and failed the "near kickoff" check —
   systematically dropping the fixtures where CLV is near zero. Re-sightings now refresh the
   timestamp, and the close is the latest quote from the same provider.
7. **`npm run verify` measured the uncalibrated model.** It built its engine without the calibration
   map. The calibration table quoted from it earlier described the raw model, not the shipped one.
8. **Calibration is roughly neutral, not a fix.** Paired on the 9,000-fixture holdout, the shipped map
   improves Brier by 0.0002 (95% CI just excludes zero) and log-loss not significantly. Inside the
   walk-forward, a map refitted per step made everything worse, because the stateful engine lets later
   fixtures reach the data the map is fitted on; the walk-forward now runs uncalibrated by default.
9. **Mobile tables were clipped on phones.** List tables kept table layout below `md`, so rows grew to
   fit their full unwrapped text and the right-hand badges were cut off — on the existing Fixtures and
   Goals & Totals lists as well as new ones. They are now block-level on phones.

10. **Live scores never updated on a cloud server.** ESPN's firewall answered the app's fixed browser
    identity with 403 "Access Denied", and the app read that as "no events", so matches stayed
    "Scheduled" after kick-off while the briefing called them started from the clock alone. ESPN calls
    now go through `espnFetch` in `engine.js`, which falls back to another identity on 403 and logs a
    block. Every page now reads match state from `src/utils/matchStatus.js`.
11. **A second self-adjusting parameter was still live while frozen.** The 15-minute reflection cycle
    nudged each league's home advantage from the latest 30 days of results. It changed predictions in
    the running app and could leak future results into a long backtest. It is now suspended while the
    model is frozen (generation 6).

## How to reproduce

```bash
npm run backtest:honest    # train on old fixtures, score unseen ones -> backtest_20k_results.json
npm run hitrate            # our hit rate beside the bookmaker's, same fixtures, same markets
npm run calibration:fit    # refit the stated-confidence -> observed-rate map -> data/calibration.json
npm run tune               # sweep fit and shaping parameters on a validation split
npm run odds:backtest      # model vs closing odds, including value-betting ROI
npm run value:backtest     # does the smart-market EV filter improve returns?
npm run verify             # regression checks, including an out-of-sample Brier floor
npm run walkforward        # rolling refit, priced at OPENING odds — the realistic historical read
npm run signal:probe       # does a candidate feature carry signal the market missed?
npm run xg:ingest          # per-fixture expected goals from understat
npm run freeze             # snapshot model + decision rules, start a forward exam
npm run forward            # score ONLY post-freeze fixtures
```

All of them hold back the most recent 9,000 fixtures and train on what came before, so no reported
figure has seen the results it is judged on.

## What the model actually uses

| Input | Status | Notes |
|---|---|---|
| Goals scored and conceded | **Used** | The entire basis of the model. 23,455 fixtures, 2021–2026. |
| Opponent-adjusted team strength | **Used** | Fitted by MLE with time decay — see `src/model/strengthFit.js`. |
| Home advantage, per league | **Used** | Fitted per league from the same corpus. |
| Elo | **Used** | Derived from results. |
| Recent form | **Used** | Rolling window over results. |
| Head-to-head record | **Used, small weight** | Weight 0.08, chosen on a validation split. |
| Bookmaker odds | **Used when available** | Domestic leagues only; the blend leans on it heavily. |
| **Player-level data** | **Not available** | No shot, minutes, injury or transfer data anywhere in the corpus. |
| **Expected goals (xG)** | **Used, top 5 leagues** | Per-fixture xG ingested from understat for 9,061 fixtures (100% coverage of EPL, LaLiga, Serie A, Bundesliga, Ligue 1). Fitted as the strength response. Measured gain is small — see below. |
| **Formations** | **Not available** | Scraped for display on the lineups page; never reaches the probability model. |
| **Referees** | **Not available** | See below. |
| **Lineups** | **Partly available, rarely informative** | See below. |

The corpus carries exactly these fields per fixture: `id, home, away, homeScore, awayScore, league,
date, timestamp, isCup`. Nothing else. Anything the model claims to know beyond results and prices
either comes from those fields or does not exist.

### Referees

`getRefereeProfile` is a table of 19 hand-written entries with invented `strictness`, `cardAvg` and
`foulsAvg` values, and a per-league guess for every other official. It used to shift both teams'
goal expectation by up to 10%, multiplied against `counterVelocity` — a per-team constant of 5 for
all but a few hardcoded clubs. Two invented numbers multiplied together, applied to the model's
central estimate, never checked against a result.

**The referee adjustment is now disabled.** The appointed official is still recorded in the ledger
under `inputs.referee` with `feedsModel: false`. To turn it back on, ingest real data (appointment
plus that official's own match history), fit the effect the way team strengths are fitted, and keep
it only if `npm run tune` shows it earning its place.

### Lineups

The lineup path does reach the model — `evaluateLineupImpact` output is passed to
`computeDixonColesProbabilities`. But with a *projected* XI it typically runs with both squads at
100% strength and no absentees, which changes nothing. The ledger previously recorded
`applied: true` for those, which read as though team news had been priced in.

The ledger now records three separate flags: `applied` (the code ran), `confirmed` (the XI was
official, not projected), and `movedTheModel` (it actually changed the probabilities). Only the last
two mean anything.

## Measured results

Out of sample, on 9,000 fixtures the model was not trained on. Of those, 3,593 have closing odds
(football-data.co.uk, vig removed) and can be compared with the bookmaker directly.

### Against the bookmaker, same fixtures and same markets

| Market (app-allowed leagues) | Model alone | What the app shows | **Bookmaker** |
|---|---|---|---|
| 1X2 | 50.7% | 53.4% | **54.1%** |
| Double chance | 74.7% | 77.5% | **78.2%** |
| Draw-no-bet (pushes out) | 66.8% | 70.4% | **71.3%** |
| Brier (lower is better) | 0.2031 | 0.1939 | **0.1914** |

**We do not beat the bookmaker.** The gap is about 3 to 4 points on 1X2, and we trail in 19 of 21
leagues with a usable sample.

### The gap is entirely in the fixtures where we disagree with the price

| | Share of games | Result |
|---|---|---|
| We agree with the price | 76% | 57.5% hit rate |
| We disagree | 24% | we are right 28.6%, the bookmaker 43.1% |

Whenever the model forms its own opinion, it is roughly 15 points worse than the price it is arguing
with. `npm run value:backtest` says the same thing from the money side: filtering to picks where the
model thinks it has found value makes returns worse, not better (−4.3% unfiltered, −12.5% when
filtered to positive model EV).

### A high hit rate is not an edge

The displayed pick matches the bookmaker's favourite on **95.9%** of fixtures, and on **100%** of
picks shown at 60%+ confidence. Those picks hit 77.3%; the bookmaker hits 77.3% on the same games.
We are restating the price and taking the shorter one.

Double chance and draw-no-bet are priced around 1.2–1.4, which needs roughly 75–83% just to break
even. A month of green ticks at 78% is the expected outcome of a losing strategy, not evidence of
skill. Read hit rate beside the bookmaker column, never alone.

### Competitions where no price exists

No cup or international competition has any closing-odds coverage, so the model runs unaided and
there is nothing to sanity-check against. Measured on unseen fixtures: Conference League 48.7%,
Europa League 49.5%, Copa del Rey 50.7%, DFB-Pokal 54.2%, Champions League 56.0% — against the 54%
managed where a price is available. Picks there now face a higher confidence bar
(`noPriceEntropySurcharge`, default 6 points).

**The UEFA Nations League has no odds coverage either**, so recent Nations League form is not
evidence of anything. Five graded smart picks landing four is exactly the 78% baseline.

## What the dashboard used to claim

`backtest_20k_results.json` scored the engine on the same 23,453 fixtures it had just been trained
on, and fed it their own odds. Its `accuracyTrend` — sixteen quarters climbing smoothly to 82.5%
elite accuracy — was not produced by any code in the repository; it was a literal in the JSON file
and a duplicate hardcoded in `BacktestAccuracyTrendChart.jsx`. `StrategyProofModal.jsx` also fell
back to hardcoded constants (56.85% raw, 72.08% high conviction, an 82.32% "holdout"), so the panel
showed confident figures even with no backtest present.

| Bucket | Previously claimed | Measured out of sample |
|---|---|---|
| Raw 1X2 | 56.85% | **48.88%** |
| High conviction ≥65% | 77.2% | **73.30%** (n=693) |
| Elite conviction ≥72% | 82.5% | **76.26%** (n=278) |
| Double chance | 81.42% | **73.24%** |

All fabricated fallbacks are gone. With no backtest on disk the panel now says so, and a file from
the old in-process routine is flagged in red as in-sample.

## Confidence now means something

Displayed confidence used to be the probability plus a per-team "predictability boost" of up to 25%
of the remaining headroom, fitted in-sample. The ≥72% bucket claimed 76.8% and returned 67.8%.

Confidence is now the calibrated probability of the pick and nothing else. The boost is still
reported as `calibration.predictabilityBoostDiagnostic` but no longer moves the number. A monotonic
isotonic map (`src/model/calibration.js`), fitted out of sample by `npm run calibration:fit`, maps
stated probability onto observed rate; mean calibration error is about 1.3pp at fit time.

Measured on the 9,000 later fixtures with the shipped map applied (`npm run verify`):

| Stated favourite probability | Fixtures | Claimed | Actual |
|---|---|---|---|
| 40–49% | 5,581 | 44.3% | 44.2% |
| 50–59% | 1,278 | 54.1% | **57.8%** |
| 60–69% | 786 | 64.5% | **67.9%** |
| 70–79% | 283 | 74.2% | 74.9% |
| 80–89% | 64 | 82.1% | 78.1% |

Well calibrated below 50% and above 70%, but **understated by about 3.5 points in the 50–70% band**,
which is where most confident picks sit. The map is fitted on an earlier window than it is measured on,
and the relationship has drifted. Understating is the safer direction, but it is still miscalibration —
refit periodically. The 80–89% row rests on 64 fixtures and is within noise.

A correction to an earlier version of this section: it quoted "73.6% claimed vs 78.7% actual" as the
shipped model's calibration. That came from `npm run verify`, which at the time built its engine in a
temporary directory without the calibration map and so was measuring the *raw* model. It now copies
the map in and prints whether it was applied.

### Calibration and evaluation

`data/calibration.json` ships fitted with `--reserve 9000`, so it has not seen the fixtures the
evaluation scripts report on. `npm run hitrate` checks for overlap and warns loudly if the map has
seen its test window. For live use, refit with `--reserve 0` to bring the map up to the latest
results; the evaluation scripts will then warn, correctly, that their figures are flattered.

## Expected goals: what it actually bought

`npm run xg:ingest` pulls per-fixture xG from understat for the top five leagues (9,061 fixtures,
100% coverage of each) and `xgWeight` blends it into the strength fit in place of goals scored.
Goals are a noisy record of how a side played; xG measures chances and is far steadier.

On the validation window it looked worth roughly a point of hit rate. **It did not replicate on the
holdout.** `npm run xg:ablation -- --window holdout`, on the 2,157 xG-league fixtures with odds:

| | Goals only | xG (weight 1) |
|---|---|---|
| 1X2 hit rate | 50.7% | **50.8%** |
| Brier | 0.1994 | **0.1990** |
| Picks at ≥60%, hit rate | 414 @ 73.4% | **361 @ 75.3%** |
| Gap to bookmaker | −3.3 | **−3.2** |

So: a real but tiny Brier improvement, no meaningful hit-rate improvement, and a genuine gain in
discrimination at the top end — confident picks land 2 points more often, on 13% fewer picks. The
control group (leagues with no xG) is unchanged to 4 decimal places, which confirms the plumbing is
doing what it claims and nothing else.

It is shipped because it is a small improvement in the right direction and costs nothing at predict
time. It is **not** the breakthrough, and it does not put us ahead of the market.

### Why adding public data does not close the gap

This is the important lesson from the xG work. Bookmakers already use xG — and shot quality models
better than understat's, plus injuries, lineups, transfers and money flow. Public data is not an
edge, it is table stakes: by the time a signal is on a public website it is in the closing price.

The gap is not a missing feature that can be bolted on. Closing it needs information the market has
not already priced, and season-level public statistics are not that. Realistically:

- Beating the **closing** line consistently is a research programme, not a feature.
- Beating an **early or soft** line is a different and much more achievable goal: the same model,
  aimed at prices posted before the market has settled, and at bookmakers slower to move.
- Shopping the best available price across books recovers more than any model change measured here,
  because most of the loss is margin, not prediction error.

## What would actually close the gap

The model is a goals-and-prices model. Bookmakers have that plus everything below, which is why they
are ahead. Ranked by expected value per unit of work:

0. **Shop prices across bookmakers.** Worth about **3 points of ROI** — more than every modelling
   change in this project combined, and the only intervention measured here that brings the published
   picks within reach of break-even. The margin on the best available closing price is 0.47% against
   5.54% on the market average. This is the highest-value work available and it is not modelling work.
1. ~~**Historical xG**~~ — **done**, and worth about 0.0004 Brier and nothing on hit rate. See
   above. Its main value turned out to be sharper confident picks, not better picks overall.
2. **Confirmed lineups plus player value or minutes-weighted availability.** The code path exists
   and does nothing without real absence data. Temper expectations: xG is generally a stronger
   signal than lineup absence, and xG moved the hit rate by 0.1 points, so this is unlikely to
   close a 3-point gap on its own. understat's per-match endpoints do carry historical rosters, so
   it is buildable — roughly 14,000 requests for the top five leagues.
3. **Rest days and travel**, computable from the fixture list we already hold. Cheapest real feature
   available — no new data source needed.
4. **Odds coverage for cups and internationals**, both to blend against and to know whether we are
   any good there. Currently a blind spot covering every cup and international fixture.
5. **Promotion and relegation handling.** A side new to a division carries strengths fitted against
   different opposition; nothing currently adjusts for that.

Formations and referees are near the bottom, not the top. They are weak signals even with good data,
and we have none. The belief that they are already being analysed is what made the model look better
than it was.

## The rolling walk-forward: the realistic historical read

`npm run hitrate` and `npm run backtest:honest` fit the model once and score a long later period.
That removes direct training-on-test leakage, but it does not describe a live model, which learns from
every result as it arrives — and it priced every decision at **closing** odds, which are only known
after the decision being tested and are the sharpest prices of the week.

`npm run walkforward` fixes both. At each step boundary the engine is rebuilt from fixtures strictly
before it — head-to-head index, league profiles, strengths and the calibration map — then scores only
the next window. Decisions and returns use the **opening** price. Closing prices are used for one
thing only: measuring closing-line value.

Over 11 steps and 5,183 priced fixtures (45-day steps, Apr 2025 → Oct 2026), uncalibrated, with
bootstrap intervals from the corrected generator:

| | Result |
|---|---|
| Market 1X2 (opening, de-vigged) | 52.56% |
| **Model only, no price supplied** | **50.11%**, gap **−2.45** pts, CI [−3.39, −1.51] |
| What the app shows (blend) | 52.54%, gap −0.02, CI [−0.41, +0.37] |
| Brier | model-only 0.2002, blend 0.1956, market 0.1947 |
| ROI at market average price | **−3.61%**, CI [−5.41, −1.92] |
| ROI at best available price | **−0.56%**, CI [−2.42, **+1.19**] |
| Mean CLV | **−0.12%**, beat the close on 48.8% |

Four things follow.

**The closing-price target was unfairly hard.** Against opening prices the model-only gap is −2.45
points; against closing prices it was about −3.5. Roughly a point of the apparent deficit came from
pricing decisions at a number that is not available when the decision is made.

**The blend's near-zero gap is not a success.** It is fed the price and therefore agrees with the
market on 98% of fixtures (105 disagreements in 5,183). Adding our model to the price neither helps
nor hurts — that is not the same as matching the market independently. The model-only row is the real
comparison, and it is behind beyond chance.

**Taking the best available price instead of the average is worth about three points of ROI** on the
same bets: −3.61% becomes −0.56%. At the average price the loss is clearly real (the interval excludes
zero); at the best price the interval includes zero, so the published picks are not distinguishable
from break-even. This is a like-for-like comparison — identical bets, different prices — and it is
still the largest effect measured in this project. Measured margins on historical closing prices: 5.54%
on the market average, 1.86% on the best of the eight named books, and 0.47% on football-data's
market-wide maximum.

**There is no timing edge.** Mean CLV is −0.12% and the model beat the closing price on 48.8% of picks
— a coin flip. The hope that it might beat a soft line even if it cannot beat a closing one is **not
supported by the data**.

By market, two groups show intervals above zero at best price: away wins (138 bets, +10.6%, CI [+0.9,
+20.4]) and home draw-no-bet (65 bets, +11.4%, CI [+0.6, +20.6]). Treat both as hypotheses for the
forward exam, not findings: six markets were tested, the samples are small, this is a window the model
was shaped against, and step-to-step ROI varies with a standard deviation of 3.9 points.

Step-to-step variation is large: the gap ranged [−1.43, +0.86] across steps and ROI at best price
[−5.46, +8.87]. Any single window, including this one, is a weak estimate.

## Testing candidate features before building them

`npm run signal:probe` asks the prior question directly: for fixtures where the market's own
probability is known, do outcomes deviate from it as a candidate feature varies? If the market has
already priced a factor, every bucket sits on zero and no amount of modelling will help.

Results across 17,503 priced fixtures:

| Candidate | Verdict |
|---|---|
| Rest-day differential | One bucket significant: a home side 3+ days *less* rested beats the market's expectation by **+4.24** pts, CI [1.00, 7.47]. See below. |
| Short rest (≤3 days), congestion | Same direction, not significant (+3.27, CI [−0.11, 6.66]) |
| Promoted / new to league | Nothing. All four buckets flat |
| Travel distance | **Not computable** — we hold no stadium coordinates |

The rest-disadvantage signal is the only candidate that survived, and it was **not** built into the
model, for three reasons. It was one significant result from fifteen buckets tested, which is roughly
what chance produces. It covers 5.2% of fixtures, so a 4-point edge there is worth about **0.22
points** overall against a 1.16-point gap to close. And it is decaying: by season the residual runs
+6.06, +8.52, +8.60, +2.59, +2.13 — consistently positive, which argues it is real, but fading in
exactly the way an inefficiency does once the market notices. Worth a proper forward test; not worth
shipping.

The xG work is the cautionary precedent: a sound, well-established feature that delivered 0.1 points
because the market already had it. Expect that outcome by default.

## Two products, measured separately — and both fail

"Beat the bookmakers" was conflating two different businesses. `npm run products` evaluates them
apart, judged against **Pinnacle's de-vigged closing line** rather than an average of all books.
Pinnacle runs at 3.1% margin against 6.2% for Bet365 and 7.1% for William Hill on our data, so its
close is the best public estimate of a true probability.

### Product A — forecasting

Produce a 1X2 probability better than the closing consensus. On 2,297 unseen fixtures with a Pinnacle
close and two or more books at open:

| | |
|---|---|
| Our 1X2 hit rate | 49.89% |
| Sharp closing line | **53.33%** |
| Gap (paired, McNemar) | **−3.44** pts, CI [−4.98, −1.90] |
| Brier | ours 0.1998, sharp close 0.1916 |

**Product A does not work**, beyond chance.

### Product B — early price

Find an opening quote generous relative to where the line settles. This asks nothing of the forecast
except that it points at the right fixtures, so it could in principle work while Product A fails.

It does not, and the reason turned out to be a flaw in the measurement rather than the strategy.

| Strategy | Bets | ROI | 95% CI | Mean EV vs closing fair |
|---|---|---|---|---|
| Model edge > 2% | 2,679 | −12.50% | [−19.10, −5.61] | **−6.02%** |
| Model edge > 5% | 2,347 | −14.23% | [−21.32, −6.57] | −6.33% |
| Model edge > 10% | 1,910 | −16.26% | [−24.44, −7.90] | −6.59% |
| Model edge > 20% | 1,338 | −19.74% | [−30.22, −7.95] | **−7.40%** |
| *Ceiling (cheats, uses the closing line)* | 1,293 | −1.00% | [−8.97, +7.32] | — |

Two things to read here. The **more edge the model claims, the worse the expected value** — its
disagreement with the price is actively anti-informative, not merely uninformative. And even the
**ceiling**, selecting with hindsight exactly those outcomes that beat the closing fair line, returns
−1.00% with an interval containing zero. There is no version of Product B that pays, so no selection
rule could have rescued it.

### The measurement bug that invented the opportunity

The first run of this analysis reported that 20% of outcomes were priced 2%+ above the closing fair
line at open — an apparently large opportunity. It was mostly an artefact of how prices were converted
to probabilities.

Dividing inverse odds by their sum assumes margin is spread in proportion to probability. Bookmakers
load more onto longshots. Measured on 16,503 Pinnacle closing lines from our own data:

| De-vigged bucket | Proportional says | Actually happens | Error | Power method error |
|---|---|---|---|---|
| 5–10% | 7.81% | 5.65% | **+2.16** | +1.26 |
| 10–20% | 15.68% | 14.17% | +1.51 | +0.84 |
| 20–35% | 27.20% | 26.86% | +0.35 | +0.14 |
| 50–70% | 58.47% | 60.19% | −1.72 | −0.87 |
| 70%+ | 77.56% | 80.99% | **−3.43** | −1.59 |

So "the best price beats the fair probability" was largely picking longshots whose fair probability had
been inflated by up to two points. `src/model/devig.js` now uses the **power method** — raise inverse
odds to a power chosen so they sum to 1 — which halves the error with no fitted parameters and cannot
reorder outcomes. Hit-rate comparisons elsewhere in this document are unaffected, because picking the
highest probability is invariant to either transform; Brier scores and every expected-value figure are
affected and now use the corrected method.

### Where the money actually is

Backing the market favourite in every evaluated fixture, priced three ways:

| Price | Bets | ROI | 95% CI |
|---|---|---|---|
| Best of books at open | 2,297 | **−2.10%** | [−6.07, +1.86] |
| Pinnacle at open | 2,284 | −3.19% | [−7.24, +1.00] |
| Pinnacle at close | 2,297 | −1.41% | [−5.51, +2.62] |

Backing the favourite loses at every price, and the three rows are not distinguishable from one
another: their intervals overlap almost entirely. An earlier version of this table showed best-of-books
at open at −0.31% and called the spread "the largest effect in the project"; that row had chosen the
favourite using the closing line, which would not have been known at the opening price.

This table mixes two things — *which* bet is chosen and *what price* it is taken at — because the
favourite can differ between prices. The clean measure of price shopping holds the bets fixed and
varies only the price; that is the walk-forward's "ROI at market average" against "ROI at best
available", reported above.

## Multi-book odds

`src/services/oddsFeed.js` is a provider-agnostic feed returning per-book quotes, a best price and a
sharp reference. It uses The Odds API when `ODDS_API_KEY` is set and otherwise reports
`multiBookAvailable: false` rather than passing one book's quote off as a consensus — a single-provider
quote comes back with `bookCount: 1` and an explicit caveat that its "fair" probability carries that
book's bias.

Historically, `npm run odds:ingest` now captures all eight books football-data.co.uk surveys, at both
open and close: Bet365 (95% coverage), Pinnacle (80%), Bwin (79%), William Hill (58%), VC (47%),
Interwetten (39%), Betfair and 1XBet (17%). Mean closing margin by book runs from Pinnacle's 3.14% to
William Hill's 7.12%, and best-of-books at close is 1.86%.

## Closing-line value: measured strictly, or not at all

The earlier CLV figure was not a like-for-like comparison, in four separate ways. All are now checked,
and any fixture failing a check is returned with `usable: false` and a reason rather than a number:

- **Same market.** It compared the 1X2 `predictedWinner` even when the frozen pick was 1X, X2 or DNB,
  so part of the "movement" was the difference between two markets. Both sides are now priced for the
  market actually frozen, derived from the 1X2 quote by the same formula.
- **A real close.** Its "close" was the last observation in the series, which can sit days before
  kickoff if collection stopped. An observation now has to fall within `clvCloseWindowMinutes`
  (default 180) of kickoff.
- **Same provider.** The provider could differ between the early quote and the last, in which case the
  number measured the gap between two bookmakers. A provider change now rejects the comparison.
- **Not an executable price.** It called an observed quote `priceTaken`. It is now `quotedPrice` with
  `executable: 'unknown'`: nothing we record establishes that a bet was available at it, that it would
  have been accepted, or at what stake. Limits and account restriction are invisible to us.

The ledger summary reports `attempted`, `usable`, `rejected` and a breakdown of rejection reasons, so
a CLV headline cannot be read without its rejection rate.

## Retiring the historical window

The 9,000-fixture holdout is now development data. It has been used to fit strengths, choose
hyperparameters, accept xG, find two league bugs and review the walk-forward. Each step was
reasonable; together they mean results on it measure how much the model has been shaped to fit it.

`npm run freeze` records the model and its decision rules — hyperparameters, calibration provenance,
staking and pricing rules, plus SHA-256 hashes of every file that decides a prediction.
`npm run forward` then scores **only** fixtures kicking off after the freeze, and states plainly if a
tracked file has changed since, because a mixed record measures neither model.

Re-freezing after a change is legitimate — that is how the model improves — but it restarts the
forward record from zero. Freezing, peeking, adjusting and re-freezing recreates the problem.

## Closing-line value: a diagnostic, not proof

Closing odds are the sharpest number in football betting, and we do not beat them. But an early or
soft line is a different proposition — the same model aimed at a price the market has not finished
arguing about.

Closing-line value measures whether the market moved toward our pick after we committed to it. It is
a useful diagnostic of timing, and it responds faster than ROI because it does not wait for results to
average out.

It is **not** proof of profit, and there is **no sample size at which it becomes proof**. An earlier
version of this document claimed 30 to 50 fixtures would settle the question; that was wrong on two
counts. CLV says nothing about the margin paid, so it can be positive while returns are negative — and
the reverse. And a mean over a few dozen skewed observations carries an interval far too wide to
conclude anything. Report it with an interval, alongside ROI at the price actually taken, and treat a
positive reading as a reason to keep looking rather than an answer.

For reference, the historical walk-forward found mean CLV of −0.12% with the close beaten on 48.8% of
picks: no timing edge.

The engine now records this automatically:

- **Early picks.** Between 6 and 96 hours before kickoff, the first time a fixture has both a
  prediction and a price, our opinion and that price are frozen to `data/early_picks.json`. Recorded
  once and never revised — a pick that can be edited afterwards proves nothing.
- **Odds history.** Every changed price for an upcoming fixture is appended to
  `data/odds_history.json` until kickoff, so the closing price is known later. Unchanged prices are
  not stored twice and the series is capped, so it stays small across a season.
- **CLV at resolution.** Each ledger entry gains a `clv` block: the price taken, the closing price,
  `clvPricePct` (how much better our price was), `clvProbPoints` (the same in probability points) and
  `beatTheClose`. This is independent of whether the pick won — a losing pick that beat the close is
  still evidence of an edge, and a winning pick that fought the market is not.
- **Summary.** `getPreKickoffLedgerSummary().closingLineValue` gives mean and median CLV, the share
  of picks that beat the close, and a plain-language reading. Below 30 fixtures it says so.

**Nothing acts on this, and the walk-forward explains why.** Measured over 3,414 historical picks,
mean CLV was −0.12% and the close was beaten 48.8% of the time. The model has no timing edge against
the opening-to-closing move, so a staking rule built on CLV would have nothing to stand on. The live
tracking stays because the forward period is what matters now, and because CLV is cheap to record.

## Tracking whether an edge is real

The ledger (`pre_kickoff_ledger.json`) now records, per fixture:

- the de-vigged bookmaker probabilities and the price taken
- `market.agreesWithMarket` and `market.edgePoints` — whether we disagreed with the price, and by how much
- `hit1X2` graded separately from `smartHit`, because a 1X pick on a draw is a hit while the headline
  HOME prediction was wrong
- `marketHit1X2` and `beatTheMarket`, so the record accumulates a head-to-head rather than a
  scoreboard with no opponent

`getPreKickoffLedgerSummary().versusBookmaker` reports our 1X2 hit rate, the bookmaker's on the same
entries, the gap, and the split on disagreements. Below 200 comparable entries it returns a caveat
saying so — at a 78% baseline it takes several hundred picks before a few points means anything.

## Forward test: AWAY and HOME_DNB picks

The walk-forward (April 2025 to October 2026) found two markets in profit: AWAY picks and home
draw-no-bet picks. They were picked out after looking at six markets, so at least one was likely to
look good by luck. Both are now registered in `data/hypotheses.json` and judged only on fixtures
played after registration. Run `npm run hypotheses`.

**First, the same rules on the earlier window.** The walk-forward was re-run over July 2022 to March
2025, a period not used to find these two markets, at the average opening price:

| Market | Window | Bets | Hit | Avg price | ROI | 95% CI |
|---|---|---|---|---|---|---|
| AWAY | 2025-04 to 2026-10 (where it was found) | 135 | 78.5% | 1.38 | +7.83% | [−1.64, +17.73] |
| AWAY | 2022-07 to 2025-04 (not used to find it) | 361 | 71.2% | 1.37 | −3.47% | [−9.67, +2.80] |
| HOME_DNB | 2025-04 to 2026-10 (where it was found) | 66 | 82.7% | 1.35 | +9.21% | [−2.35, +20.52] |
| HOME_DNB | 2022-07 to 2025-04 (not used to find it) | 111 | 87.5% | 1.34 | +12.17% | [+4.92, +18.85] |

AWAY did not replicate: most likely a lucky 18 months. HOME_DNB did, with an interval clear of zero.
Two cautions. The model's settings were tuned on the earlier period, which flatters the model (though
not the choice of market). And at the average price the recent HOME_DNB interval already included
zero; the "significant" AWAY figure quoted earlier was at the best price across books, which the live
app does not have (see Multi-book odds: there is no `ODDS_API_KEY`, so live prices are one ESPN quote).

**What is fixed at registration** (and not edited once fixtures are scored; a changed rule is a new
registration starting from zero):

- *Rule:* the frozen model's published smart pick is AWAY, or HOME_DNB. Nothing else qualifies.
- *Price:* the quote frozen once in `data/early_picks.json`, 6 to 96 hours before kickoff.
- *Model:* generation 6 (re-registered from 5 before any fixture was scored). Every early pick is now stamped with the generation that made it, and picks
  from any other version are left out.
- *Scope:* the 23 leagues the historical estimates came from. Other leagues are reported apart.
- *Decision:* from 50 bets, abandon at any look where the whole 95% interval is below zero. Judge
  once, at 300 bets: supported only if the whole interval is above zero. Interim looks never confirm.

**How long it takes.** In these leagues the model published about 7.5 AWAY and 3.7 HOME_DNB picks a
month. At that pace the abandon check becomes possible after roughly 7 months (AWAY) and 14 months
(HOME_DNB), and the 300-bet judgement after roughly 3½ and 7 years. These are short-priced bets
(about 1.35), so each return varies less than a longshot's, but a real edge of +5% still needs about
500 to 1,200 bets to show reliably. The forward test will mostly work as a kill switch; confirming
an edge this size takes years at this pick rate.

## Goals markets (over/under, both teams to score)

Measured out of sample (walk-forward, 14,700 fixtures), the scoreline grid expected about 3.2 goals a
game against 2.8 actually scored. Every over and BTTS figure ran high, and the goals tips hit no more
often than always backing the more common outcome.

The four goals figures now come from a small fitted model per market (`src/model/goalsModel.js`),
using only the engine's expected goals for each side. Fitted on July 2022 – March 2025, scored on
April 2025 onwards (5,185 fixtures it never saw):

| Market | Always pick the common side | Model | Brier (model vs average) | When the model is 60%+ sure |
|---|---|---|---|---|
| Over 1.5 | 77.1% | 77.1% | 0.1750 vs 0.1766 | every game (always over) |
| Over/under 2.5 | 53.5% | 53.6% | 0.2454 vs 0.2488 | 891 games, **64.2%** |
| Over/under 3.5 | 69.7% | 69.8% | 0.2069 vs 0.2113 | 4,693 games, 71.4% |
| Both teams score | 54.3% | 54.0% | 0.2474 vs 0.2482 | 152 games, **64.5%** |

The probabilities are now honest (they beat guessing the average on every market), but across all
games goal totals remain close to a coin flip. The useful tips are the confident ones: on the Goals
page use the "60%+ chance" filters. Recent team form (goals for/against, over and BTTS rates, clean
sheets) was tested as extra input and added less than 0.001 to the Brier score, so it is not used.

Refit with:

```bash
npm run walkforward -- --from 2022-07-01 --to 2025-04-01 --goals-out /tmp/goals-early.json
npm run walkforward -- --goals-out /tmp/goals-recent.json
npm run goals:fit -- --train /tmp/goals-early.json --test /tmp/goals-recent.json
```

The shipped `data/goals-model.json` is refitted on both windows together; the table above is the
held-out score. Any later walk-forward run over those windows is therefore in-sample for goals.

## Corners and cards

These used to be guesses: fixed league averages typed into the code, multiplied by a referee
"strictness" from a hand-written table, a flat +28% for a list of derbies, and a formation bonus.
None of it had been checked against a real result, and the page's "recent results" list assigned
made-up hits and misses to real past matches.

They now come from `src/model/matchStats.js`, built from the corners and cards football-data.co.uk
records for every match in the 14 main European leagues (29,891 matches since 2020-21). Each league
keeps its average home and away corners and cards; each team keeps how far above or below that it
runs, for and against, updated a little after every match. The model replays every match in date
order, so every figure below was made before kick-off. Scored on 2024-25 onwards (10,345 matches):

| Line | Always pick the common side | Model | Brier (model vs one rate for all leagues) | When the model is 60%+ sure |
|---|---|---|---|---|
| Corners 8.5 | 62.2% | 62.2% | 0.2309 vs 0.2351 | 5,667 games, 67.5% |
| Corners 9.5 | 50.7% | 55.5% | 0.2463 vs 0.2500 | 2,366 games, 59.9% |
| Corners 10.5 | 60.8% | 60.8% | 0.2345 vs 0.2384 | 5,824 games, 65.8% |
| Cards 3.5 | 60.9% | 63.2% | 0.2257 vs 0.2381 | 6,056 games, **69.1%** |
| Cards 4.5 | 56.7% | 61.5% | 0.2313 vs 0.2455 | 5,602 games, **67.0%** |

The chances shown are honest: grouped by the chance given, picks shown at 60–65% came in 63%, at
70–75% 73%, at 80–85% 82%. The strongest tip per match came in 83% of the time, but those are the
safe lines (over 7.5 corners, over 2.5 cards) and pay little. Cards carry more signal than corners.

**Market adjustment.** When a match has prices (or market memory), each line is adjusted by the
market's expected total goals and how one-sided it expects the match to be: tight matches draw more
cards. Fitted on seasons before 2024-25, scored after: cards 4.5 confident picks 4,778 at 69.0%
(was 5,602 at 67.0%), Brier better on every corners and cards line, and the strongest tip per match
83.4% (was 83.0%).

Tested and left out: referees (named in the English and Scottish files) made no difference out of
sample once each team's own record was known. Only fixtures where both teams play in one of the 14
leagues get corners and cards figures; cup ties between leagues and other leagues get none.

`npm run stats:fit` rebuilds `data/match-stats.json` and prints the table above. The server also
refreshes the ratings once a day into `data/match-stats.live.json` (not in git).

## Exact score

Scored on 14,700 walk-forward fixtures, the most likely score was right 12.2% of the time. Always
guessing 1-1 was right 11.7%; the model picks 1-1 in 71% of games. The top three scores together
covered 30.5%, against 29.7% for always 1-1, 1-0, 0-1. Scaling expected goals down to match the
real average improved the probabilities slightly but not the hit rate, so the engine is unchanged.
The shown percentage is roughly honest from 9% to 14%, but games shown at 16% or more came in only
about 5% of the time, so the "likely score 14%+ / 16%+" filters were removed.

## Managers

Managers were hard-coded (several were out of date), and the ESPN lookup meant to replace them
read a field ESPN does not send. They now come from Wikidata's current head coach for each club or
national team (`src/services/coaches.js`), cached for a week. A manager set on the Match research
page overrides it and is kept in `data/manager-overrides.json`. The invented team news for about 36
clubs was removed.

## Expected goals from bookmaker prices

A lab over the 29,899 matches in the football-data.co.uk files (goals, shots, corners, cards and
opening, closing and over/under prices) tested every source of expected goals against results on
2024-25 onwards, 10,348 matches none of the fitting saw.

**Today's prices beat our own goals model on every goals market.** The expected goals that reproduce
the opening match-result prices (`impliedGoals` in `src/model/marketGoals.js`), run through the same
small calibration as the goals model (`data/goals-model-market.json`, `npm run goals:fit-market`):

| Market | Our model | From prices | Confident (60%+) picks |
|---|---|---|---|
| Over/under 2.5 | ~53.6% | **57.3%** | 3,020 at 64.8% (was 891 at 64.2%) |
| Both teams score | 54.0% | **55.7%** | 1,504 at 61.5% |
| Over/under 3.5 | 69.8% | 70.1% | |
| Exact score | 12.2% | **13.3%** | top three 34.1% (was 30.5%) |

Adding our model's expected goals on top of the price-implied ones changed nothing measurable, so
when a price exists the app uses it. ESPN's over/under price, on whatever line it is quoted, is used
too when present.

**Past prices beat results for matches with no price.** `MarketMemory` learns each team's attack
and defence from the expected goals implied by its past prices, not from its scorelines. Prices
carry far less noise than results. For a match with no odds:

| Team ratings learned from | Hit | Log loss |
|---|---|---|
| The match's own opening price (for reference) | 51.9% | 0.985 |
| Past prices (market memory) | 51.3% | 0.989 |
| Shots on target | 50.6% | 1.005 |
| Results | 49.9% | 1.008 |

It is used only when both teams have at least five priced matches in the fixture's league, and it
is switched off wherever the app replays or grades past matches (`ignoreMarketGoals`), since it
has learned from those matches' own prices.

**Walk-forward on the app itself** (April 2025 onwards, 5,183 fixtures, engine rebuilt from history
at every step):

| | Before | After |
|---|---|---|
| Hit rate with no price supplied | 50.1% | **51.3%** (market 52.6%) |
| Hit rate of what the app shows | 52.5% | 52.7% |
| Brier of what the app shows | 0.1956 | **0.1947** (market 0.1947) |
| ROI at best price | -0.6% | -0.1% |
| Over/under 2.5 hit | 54.4% | **57.1%** |
| Both teams score hit | 53.9% | **56.2%** |
| Exact score / top three | 12.2% / 30.5% | **13.0% / 33.1%** |

**What did not work.** Nothing tested beat the opening match-result price itself: stacking it with
market memory, results-based or shots-on-target ratings left log loss at 0.9837 against 0.9837 for
the recalibrated price alone. For corners and cards, fouls and shots added nothing; the market's
view of the match (expected total and how one-sided it is) improved cards slightly (Brier 0.2257 to
0.2234 on the 3.5 line) and corners hardly at all.

## Team goals and first-half goals

From price-implied expected goals (not from the model's own, which were never tested), the app now
also shows each team's chance to score and the chance of a goal in the first half. First-half goals
use 46% of the full-match expected goals, the share that fitted half-time scores best. On 10,345
matches from 2024-25 the raw chances were already calibrated (recalibrating moved Brier by under
0.001). When the chance shown was 80% or more:

| Tip | Picks | Came in |
|---|---|---|
| Home team to score | 4,175 | 87.4% |
| Away team to score | 1,802 | 87.1% |
| Goal in the first half | 627 | 84.5% |

The Goals page filters "Home/Away team scores, 80%+" and "Goal in first half, 75%+" use these. Its
"Over 3.5" used to be shown as the over 2.5 chance minus 28 points, and its "best value" column an
invented edge; both now show the engine's real figures, and the best tip is the most likely one.
