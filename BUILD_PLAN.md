# 🚀 AI Sports Betting & Prediction Engine: Next-Generation Comprehensive Build & Verification Plan

**Target Execution Lead**: Automated Autonomous Engineering Engine (Claude Opus / Super-Agent Architect)  
**System Version**: v4.8.0-Production  
**Timestamp**: September 2026  
**Primary Goal**: Total logic synchronization, risk parity audit, statistical model calibration against out-of-sample test fixtures, seamless filter-to-betslip state continuity, and autonomous auto-patching hardening.

---

## 📑 Table of Contents
1. [Executive Summary & Core Directives](#1-executive-summary--core-directives)
2. [Critical Discrepancy Audits (High-Priority Bug Fixes)](#2-critical-discrepancy-audits-high-priority-bug-fixes)
   - [2.1 The "Low Risk Added → High Risk on Bet Slip" Conflict](#21-the-low-risk-added--high-risk-on-bet-slip-conflict)
   - [2.2 Universal Risk & Conviction Taxonomy](#22-universal-risk--conviction-taxonomy)
3. [Dixon-Coles & Poisson Model Gaps (Empirical Verification)](#3-dixon-coles--poisson-model-gaps-empirical-verification)
   - [3.1 Model Calibration & Brier Score Validation](#31-model-calibration--brier-score-validation)
   - [3.2 League Predictability Tier Discipline (Tier 1 vs 2 vs 3)](#32-league-predictability-tier-discipline-tier-1-vs-2-vs-3)
   - [3.3 Draw-No-Bet (DNB) & Double Chance (DC) Mathematical Edge](#33-draw-no-bet-dnb--double-chance-dc-mathematical-edge)
4. [Universal Filtering & Sorting Integrity Matrix](#4-universal-filtering--sorting-integrity-matrix)
   - [4.1 Global Filter Contract & In-Memory Cache Sync](#41-global-filter-contract--in-memory-cache-sync)
   - [4.2 Zero-Loss State Transmission Across Views](#42-zero-loss-state-transmission-across-views)
5. [Autonomous Patching & Model Self-Reflection Architecture](#5-autonomous-patching--model-self-reflection-architecture)
   - [5.1 Self-Prompting Diagnostic Cycle](#51-self-prompting-diagnostic-cycle)
   - [5.2 Hot-Patch Verification Pipeline](#52-hot-patch-verification-pipeline)
6. [UI/UX Polish & Interactive Live Stream Experience](#6-uiux-polish--interactive-live-stream-experience)
7. [Step-by-Step Autonomous Execution Checklist](#7-step-by-step-autonomous-execution-checklist)

---

## 1. Executive Summary & Core Directives

The platform operates as a dual-engine architecture:
1. **Backend Engine (`engine.js`, `server.js`)**: Dixon-Coles bivariate Poisson models, continuous training ledger, real-time live scrapers, AI swarm deliberation, and in-frame stream proxying.
2. **Frontend UI Suite (`Dashboard.jsx`, `FixturesTablePage.jsx`, `BetSlip.jsx`, `DailyBriefingPanel.jsx`, `LiveMatchPlayerModal.jsx`)**: Responsive analytical displays, accumulator optimizers, multi-slip managers, and in-frame match viewers.

### Primary Objectives for This Build
* **Zero Discrepancy Guarantee**: A fixture classified as "Low Risk" / "Elite Edge" in table filters must NEVER magically display as "High Risk / Trap" when added to a Bet Slip.
* **Deterministic Risk Pipeline**: Centralize all risk calculations into a single universal utility function (`src/utils/riskUtils.js`) used by every component and backend endpoint.
* **Autonomous Model Health Checks**: Implement automated validation tests against 9,000+ historical fixtures to identify and resolve prediction anomalies.
* **Flawless In-Frame Streaming & Status Transition**: Guarantee kickoff-to-full-time status transitions and robust multi-source in-frame live stream rendering.

---

## 2. Critical Discrepancy Audits (High-Priority Bug Fixes)

### 2.1 The "Low Risk Added → High Risk on Bet Slip" Conflict

#### Problem Identified:
A user filters fixtures using **"Low Risk" / "No Traps" / "High Confidence" (≥60%)**, selects an elite pick (e.g. Manchester City at 78%), and adds it to their Bet Slip. Upon opening the Bet Slip, the card displays a red warning badge: `⚠️ High Risk` or `Contrarian Trap Detected`.

#### Root Cause Analysis:
1. **Divergent Evaluation Criteria**:
   - `FixturesTablePage.jsx` checks `m.confidence >= 60 && !m.isMarketDivergence`.
   - `BetSlip.jsx` was independently calculating risk using raw odds without factoring in `m.smartMarket` or `m.disruptionModel` overrides.
   - If market odds were short (e.g. 1.25), `BetSlip.jsx` triggered a generic "Low Value / Trap" alert even though the model confirmed an Elite Conviction rating.
2. **Missing Transmitted Context in `handleAddPick`**:
   - When a match is added to the slip, custom market parameters (`customPick`, `smartMarket`, `dnbAdvised`) were partially stripped, forcing the slip component to re-infer properties with different fallback formulas.

#### Permanent Solution & Fix Plan:
- [x] Create **`src/utils/riskUtils.js`** as the single source of truth for:
  - `getMatchRiskProfile(match)`: Returns `{ riskLevel: 'LOW' | 'MEDIUM' | 'HIGH', riskScore: number, isTrap: boolean, badge: string, color: string, reason: string }`.
  - `isLowRiskPick(match)`: Unified boolean helper.
- [x] Refactor `handleToggleAccaPick` in `Dashboard.jsx`, `FixturesTablePage.jsx`, `BetSlip.jsx`, `AccumulatorPage.jsx`, and `BinaryPicksPage.jsx` to consume `getMatchRiskProfile`.
- [x] Ensure full pick payload retention (`smartMarket`, `binaryModel`, `disruptionModel`, `odds`, `confidence`, `leagueTier`) across local storage and multi-slip state.

---

### 2.2 Universal Risk & Conviction Taxonomy

| Tier / Category | Model Win Probability ($P$) | Confidence Score | Draw Risk ($P_{draw}$) | DNB Recommendation | UI Badge |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Elite Conviction (Low Risk)** | $\ge 68.0\%$ | $\ge 72.0$ | $< 22.0\%$ | Straight Win | `👑 Elite (Low Risk)` (Emerald) |
| **High Edge (Standard Low)** | $60.0\% - 67.9\%$ | $60.0 - 71.9$ | $< 24.0\%$ | Straight Win | `🛡️ High Confidence` (Teal) |
| **Safety Protected (Adaptive)** | $48.0\% - 59.9\%$ | $52.0 - 59.9$ | $\ge 24.0\%$ | **DNB / Double Chance** | `🛡️ DNB Advised` (Indigo) |
| **Contested Parity (Moderate)** | $40.0\% - 47.9\%$ | $45.0 - 51.9$ | $\ge 28.0\%$ | Double Chance (1X/X2) | `⚖️ Contested` (Amber) |
| **Trap / High Parity (High Risk)** | Any with Disruption | $< 45.0$ | Any | **Avoid / PASS** | `⚠️ Volatile / Trap` (Rose) |

---

## 3. Dixon-Coles & Poisson Model Gaps (Empirical Verification)

### 3.1 Model Calibration & Brier Score Validation
* **Brier Score Target**: Ensure global weighted Brier score $\le 0.178$ across covered leagues.
* **Poisson Low-Score Correlation ($\rho$)**:
  - Implement dynamic $\tau_{\lambda, \mu}(x, y)$ Dixon-Coles correlation adjustments for $0-0, 1-0, 0-1, 1-1$ scorelines:
    $$\tau_{\lambda, \mu}(x, y) = \begin{cases} 1 - \lambda \mu \rho & \text{for } x=0, y=0 \\ 1 + \mu \rho & \text{for } x=0, y=1 \\ 1 + \lambda \rho & \text{for } x=1, y=0 \\ 1 - \rho & \text{for } x=1, y=1 \\ 1 & \text{otherwise} \end{cases}$$
* **Goal Dispersion Factor ($r$)**: Enforce negative binomial overdispersion for volatile cup competitions (e.g. Copa Chile, FA Cup).

### 3.2 League Predictability Tier Discipline
* **Tier 1 (High Reliability)**: Premier League, La Liga, Serie A, Bundesliga, Champions League. (Strict mathematical modeling; 64%–72% baseline accuracy).
* **Tier 2 (Standard Edge)**: Ligue 1, Primeira Liga, Eredivisie, MLS, Europa League.
* **Tier 3 (Volatile / High Parity)**: Championship, Serie B, Segunda División, South American domestic cups. (Mandatory DNB or Double Chance enforcement).

---

## 4. Universal Filtering & Sorting Integrity Matrix

### 4.1 Filter Test Scenarios

| Test ID | Filter Preset | Expected Table Fixtures | Expected Bet Slip Behavior |
| :--- | :--- | :--- | :--- |
| **TC-01** | `Quality: Elite Edge (≥68%)` | Shows ONLY matches with $P \ge 68\%$ & no trap flags. | Adding to slip shows **Elite Conviction (Low Risk)** badge with 0 warnings. |
| **TC-02** | `Quality: High Confidence (≥60%)` | Matches with $P \ge 60\%$. | Shows **High Confidence** on slip without contradiction. |
| **TC-03** | `Special: No Traps / Risk-Free` | Excludes all high-draw risk ($\ge 26\%$) and contrarian traps. | Slip confirms **Zero Trap Alerts**. |
| **TC-04** | `Market: Draw-No-Bet (DNB)` | Filters for games with Draw prob $\ge 24\%$. | Slip auto-selects **DNB** and displays refund protection. |
| **TC-05** | `Major Leagues Only` | Filters out non-tier-1 divisions. | Preserved when clearing text search queries. |

---

## 5. Autonomous Patching & Model Self-Reflection Architecture

### 5.1 Self-Prompting Diagnostic Cycle (`engine.js`)
* Executes every 15 minutes in the background.
* Compares predicted outcome distributions vs. actual completed match scorelines over the trailing 30-day window.
* Automatically adjusts league-specific home advantage parameters ($\gamma_{league}$) if home win rate drifts $>3.5\%$ from empirical reality.

### 5.2 Hot-Patch Verification Pipeline
```
[Scrape ESPN / FlashScore / Scoreboards]
                 │
                 ▼
[Elapsed Time & Match Completion Guard (Kickoff > 130m → FT)]
                 │
                 ▼
[Dynamic Dixon-Coles Poisson + AI Swarm Deliberation]
                 │
                 ▼
[Universal Risk & Conviction Assignment (riskUtils.js)]
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
[Fixtures Table]     [Multi-Bet Slips]
  (Consistent)         (Consistent)
```

---

## 6. UI/UX Polish & Interactive Live Stream Experience

* **Real-time Internet Stream Scraper**:
  - Automatically queries `/api/scrape-match-streams` on opening any live match.
  - Prioritizes 100% in-frame embeddable streams (Sportzx HD, YouTube Live Commentary, Score808, Totalsportek).
  - Routes external streams through `/api/stream-frame-embed` proxy to strip frame-busting scripts and CORS/CSP restrictions.
* **Match Status Ticker**:
  - Real-time minute increments for ongoing games.
  - Automatic transition to `FT` when time exceeds 130 minutes.

---

## 7. Step-by-Step Autonomous Execution Checklist

- [x] **Phase 1: Risk Logic Unification**
  - [x] Implement `src/utils/riskUtils.js`.
  - [x] Refactor `Dashboard.jsx`, `FixturesTablePage.jsx`, `BetSlip.jsx`, `AccumulatorPage.jsx`, and `BinaryPicksPage.jsx` to use `riskUtils.js`.
  - [x] Verify that filtering by "Low Risk" and adding to slip preserves identical green Low Risk / Elite badges.

- [x] **Phase 2: Dixon-Coles Mathematical Audit & Out-of-Sample Testing**
  - [x] Audit `computeDixonColesProbabilities` in `engine.js` against sample test fixtures.
  - [x] Validate Poisson tail decay and Draw-No-Bet threshold accuracy ($P_{draw} \ge 24.0\%$).
  - [x] Verify that matches >130 minutes past kickoff never appear as `LIVE / STARTED`.

- [x] **Phase 3: Autonomous Self-Healing & Patching Routines**
  - [x] Verify `/api/deep-retrain-patch` and `/api/retrain` endpoint responsiveness.
  - [x] Audit `fixtures_cache.json` disk serialization and recovery mechanisms.

- [ ] **Phase 4: UI/UX & Cross-Device Polish**
  - [x] Test table sorting by Conf, Odds, Probability, xG, and Kelly stake.
  - [ ] Verify Live Match Player Modal in-frame stream playback and Popout fallbacks. **(Audited 2026-09-26: no scraped source plays in-frame — see §8.)**
  - [x] Run full build verification via `compile_applet`.

---

## 8. Execution Status (2026-09-26)

Run `npm run verify` (scripts/verify-build.mjs) to re-check everything below.

* **Risk parity**: `riskUtils.getMatchRiskProfile` drives table filters, table badges, bet slip badges and binary picks; table and slip evaluate the same pick (`getSlipPick`). 0 mismatches across 155 live fixtures; TC-01–TC-04 pass. BetSlip lives in `AccumulatorPage.jsx` (there is no `BetSlip.jsx`), and the slip now prefers live match data over the stored snapshot.
* **Dixon-Coles τ**: the code in `engine.js` matches Dixon & Coles (1997): τ(0,1)=1+λρ, τ(1,0)=1+μρ. The formula in §3.1 above has those two cases swapped; the code was left as is.
* **Calibration (temporal split: trained on 14,453 fixtures, tested on the 9,000 that followed)**: temperature 0.8 → 1.3 (chosen on a validation slice, not the test set) and maxScorelineSim 6 → 10 (tail mass 3.4% → 0.03%). Brier (mean per-class) 0.2100 → 0.2076; 60–69% favourites now predicted 64.5% vs actual 63.5% (previously 64.6% vs 53.8%). **The 0.178 target is not met.** Softer probabilities also mean fewer Elite/High picks and more DNB-advised fixtures.
* **§5.1 home-advantage drift**: `calibrateLeagueHomeAdvantage` runs in the 15-minute reflection cycle.
* **Phase 3**: fixtures cache writes are atomic (tmp + rename) with `.bak` recovery. Deep retrain (~3.5 min) now yields to the event loop and isolates trial hyperparameters, so the API stays responsive.
* **TC-04**: Draw-No-Bet is now a real pick type (`HOME_DNB` / `AWAY_DNB`) priced at O_win × (O_draw − 1) / O_draw, with P(win | no draw) as its probability. The table's "+ Slip" adds the market shown for the selected Market mode (`riskUtils.getMarketPick`), and slip legs show a "🛡️ Refund if Draw" chip. Covered by `npm run verify`.
* **TC-05**: the search "×" button only clears the search text, so the Top Leagues filter stays on (checked in code; the browser run was cut short when the tab froze).
* **Fixed**: `Dashboard.jsx` called `safeToFixed` without importing it, so every add-to-slip click crashed the page (introduced in b4d7ed7).
* **Live streams**: browser test showed nothing plays in-frame. The YouTube `listType=search` embed is deprecated, the "scraped" links are how-to-watch articles or subscription/DRM players (DAZN, ESPN), and Totalsportek/Score808 fetches fail. The proxy now blocks SSRF (private/loopback/metadata hosts, non-http schemes) and escapes reflected HTML. Open risk: the proxied third-party pages are served from the app's own origin, and the iframe sandbox includes `allow-scripts allow-same-origin`, so their scripts run with full app-origin privileges.
