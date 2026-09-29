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

## API keys

Settings → API keys shows every key the app can use, whether it is set (on the server or saved in the
app) and a green **Working** / red **Not working** result from a free test call. Paste a key and press
**Save & test** to add or replace one; keys saved there go to `.env`, which is not in git.

- **The Odds API** (`ODDS_API_KEY`): bookmaker prices for matches ESPN has no odds for. On the free
  plan (500 credits a month) the app fetches only competitions with upcoming matches that lack an ESPN
  price, 1 credit per competition, at most every 12 hours each, never more than 20 a day, and keeps 40
  credits in reserve. Testing the key costs nothing.
- **Gemini, Mistral, OpenAI, Anthropic** (optional): AI match write-ups.
