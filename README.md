# soccer_predictor
Soccer predictor

## Accuracy and how it is measured

See [docs/MODEL_ACCURACY.md](docs/MODEL_ACCURACY.md) for what the model actually uses, what it does
not, and every figure measured against bookmaker closing odds.

```bash
npm run backtest:honest    # train on old fixtures, score unseen ones
npm run hitrate            # our hit rate beside the bookmaker's, same fixtures and markets
npm run calibration:fit    # refit stated confidence -> observed rate
npm run tune               # sweep fit/shaping parameters on a validation split
npm run verify             # regression checks incl. an out-of-sample Brier floor
```

Read hit rate beside the bookmaker column, never on its own: double chance and draw-no-bet land
about 78% of the time at prices that need 75–83% to break even.
