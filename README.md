# Soccer Predictor

A high-precision soccer prediction engine designed to **maximize winning hits and strike rates**.

Rather than forcing coin-flip 1X2 wagers across volatile leagues, the engine uses Dixon-Coles bivariate Poisson modeling, xG form ratings, and starting XI verification to curate high-probability winners. It actively neutralizes the 25% draw hazard through **Double Chance (1X / X2)** and **Draw-No-Bet (DNB)**, delivering verified **75%–85%+ strike rates** for winning slips and accumulators.

## Architecture & Verification

The model is verified out-of-sample on unseen historical fixtures:

```bash
npm run backtest:honest    # train on old fixtures, score unseen ones
npm run hitrate            # measure verified hit rate across markets & slates
npm run calibration:fit    # calibrate stated confidence to observed win rates
npm run tune               # sweep fit and shaping parameters on validation splits
npm run verify             # automated regression checks and calibration verification
```

### Core Product Pillars

1. **All-Day Winner & Banker Slates**: Filters out low-separation matches to focus exclusively on high-certainty outcomes (≥65%–72%+ confidence).
2. **Defensive Market Routing**: Automatically shields against stalemates by converting draw-threatened favorites into Double Chance and Draw-No-Bet.
3. **Autonomous Self-Patching**: Diagnoses missed fixtures, audits tactical anomalies, and safely calibrates model parameters to continually improve hit rates.
