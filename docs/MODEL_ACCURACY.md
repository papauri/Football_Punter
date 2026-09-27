# Model accuracy: what is measured, and what the model actually knows

This document exists because the dashboard used to report numbers that were not measured, and
because the model was widely believed to analyse inputs it does not have. Both are covered below,
with the commands to reproduce every figure.

## How to reproduce

```bash
npm run backtest:honest    # train on old fixtures, score unseen ones -> backtest_20k_results.json
npm run hitrate            # our hit rate beside the bookmaker's, same fixtures, same markets
npm run calibration:fit    # refit the stated-confidence -> observed-rate map -> data/calibration.json
npm run tune               # sweep fit and shaping parameters on a validation split
npm run odds:backtest      # model vs closing odds, including value-betting ROI
npm run value:backtest     # does the smart-market EV filter improve returns?
npm run verify             # regression checks, including an out-of-sample Brier floor
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
| Raw 1X2 | 56.85% | **49.06%** |
| High conviction ≥65% | 77.2% | **74.13%** (n=630) |
| Elite conviction ≥72% | 82.5% | **79.28%** (n=304) |
| Double chance | 81.42% | **73.24%** |

All fabricated fallbacks are gone. With no backtest on disk the panel now says so, and a file from
the old in-process routine is flagged in red as in-sample.

## Confidence now means something

Displayed confidence used to be the probability plus a per-team "predictability boost" of up to 25%
of the remaining headroom, fitted in-sample. The ≥72% bucket claimed 76.8% and returned 67.8%.

Confidence is now the calibrated probability of the pick and nothing else. The boost is still
reported as `calibration.predictabilityBoostDiagnostic` but no longer moves the number. A monotonic
isotonic map (`src/model/calibration.js`), fitted out of sample by `npm run calibration:fit`, maps
stated probability onto observed rate; mean calibration error is about 1.1pp at fit time.

The model now leans slightly *under*confident at the top of the range (73.6% claimed vs 78.7%
actual, per `npm run verify`), because the map is fitted on an earlier window than it is measured
on. Understating is the safer direction, but it is still miscalibration — refit periodically.

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
