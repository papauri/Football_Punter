import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Info,
  Layers,
  Clock,
  Globe,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Scale,
  Compass
} from 'lucide-react';
import UniformDropdown from './UniformDropdown';
import KellyTooltip from './KellyTooltip';

export default function TuningPage({
  state = {},
  tuningConfig = {},
  onSaveTuning,
  onRefreshState,
  isSaving = false,
  tzSettings = {},
  onUpdateTzSettings
}) {
  const [homeAdvantage, setHomeAdvantage] = useState(tuningConfig.homeAdvantage ?? 0.25);
  const [homeEloBoost, setHomeEloBoost] = useState(tuningConfig.homeEloBoost ?? 75);
  const [entropyFloorThreshold, setEntropyFloorThreshold] = useState(tuningConfig.entropyFloorThreshold ?? 52.0);
  const [paritySafetyThreshold, setParitySafetyThreshold] = useState(tuningConfig.paritySafetyThreshold ?? 68.0);
  const [highDrawFloor, setHighDrawFloor] = useState(tuningConfig.highDrawFloor ?? 26.0);
  const [dixonColesRho, setDixonColesRho] = useState(tuningConfig.dixonColesRho ?? -0.12);
  const [eloKFactor, setEloKFactor] = useState(tuningConfig.eloKFactor ?? 24);
  const [fatiguePenalty, setFatiguePenalty] = useState(tuningConfig.fatiguePenalty ?? 0.08);
  const [kellyFraction, setKellyFraction] = useState(tuningConfig.kellyFraction ?? 0.25);
  const [minConfidenceThreshold, setMinConfidenceThreshold] = useState(tuningConfig.minConfidenceThreshold ?? 58);
  const [disabledLeagues, setDisabledLeagues] = useState(tuningConfig.disabledLeagues || []);
  const [savedSuccess, setSavedSuccess] = useState(false);
  
  // Blacklist specific save & loading state
  const [isSavingBlacklist, setIsSavingBlacklist] = useState(false);
  const [blacklistSavedSuccess, setBlacklistSavedSuccess] = useState(false);

  // Sync state if tuningConfig changes externally
  useEffect(() => {
    if (Array.isArray(tuningConfig.disabledLeagues)) {
      setDisabledLeagues(tuningConfig.disabledLeagues);
    }
  }, [tuningConfig.disabledLeagues]);
  
  // Timezone local state
  const [selectedZone, setSelectedZone] = useState(tzSettings.zone || 'UTC');
  const [hourFormat, setHourFormat] = useState(tzSettings.hour24 ? '24' : '12');
  const [tzSavedSuccess, setTzSavedSuccess] = useState(false);

  const timezoneOptions = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'Europe/London', label: 'London / Dublin (GMT / BST)' },
    { value: 'Europe/Paris', label: 'Paris / Berlin / Madrid / Rome (CET / CEST)' },
    { value: 'Europe/Athens', label: 'Athens / Istanbul (EET / EEST)' },
    { value: 'America/New_York', label: 'New York / Eastern Time (EST / EDT)' },
    { value: 'America/Chicago', label: 'Chicago / Central Time (CST / CDT)' },
    { value: 'America/Denver', label: 'Denver / Mountain Time (MST / MDT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles / Pacific Time (PST / PDT)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    { value: 'Asia/Dubai', label: 'Dubai / Gulf Standard (GST)' },
    { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
    { value: 'Asia/Bangkok', label: 'Bangkok / Jakarta (ICT)' },
    { value: 'Asia/Singapore', label: 'Singapore / Hong Kong (SGT / HKT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo / Seoul (JST / KST)' },
    { value: 'Australia/Sydney', label: 'Sydney / Melbourne (AEST / AEDT)' }
  ];

  const handleApplyPreset = (presetKey) => {
    if (presetKey === 'DEFAULT') {
      setHomeAdvantage(0.25);
      setHomeEloBoost(75);
      setEntropyFloorThreshold(52.0);
      setParitySafetyThreshold(68.0);
      setHighDrawFloor(26.0);
      setDixonColesRho(-0.12);
      setEloKFactor(24);
      setFatiguePenalty(0.08);
      setKellyFraction(0.25);
      setMinConfidenceThreshold(58);
    } else if (presetKey === 'CONSERVATIVE') {
      setHomeAdvantage(0.20);
      setHomeEloBoost(65);
      setEntropyFloorThreshold(55.0);
      setParitySafetyThreshold(72.0);
      setHighDrawFloor(24.0);
      setDixonColesRho(-0.08);
      setEloKFactor(16);
      setFatiguePenalty(0.12);
      setKellyFraction(0.15);
      setMinConfidenceThreshold(65);
    } else if (presetKey === 'AGGRESSIVE') {
      setHomeAdvantage(0.32);
      setHomeEloBoost(85);
      setEntropyFloorThreshold(50.0);
      setParitySafetyThreshold(64.0);
      setHighDrawFloor(28.0);
      setDixonColesRho(-0.16);
      setEloKFactor(32);
      setFatiguePenalty(0.05);
      setKellyFraction(0.35);
      setMinConfidenceThreshold(52);
    }
  };

  const handleAiAutoFilter = () => {
    const suggestedToDisable = [];
    
    // Auto-disable if accuracy is below 62% in historical backtesting
    (state.trainingStats?.leaguePerformance || []).forEach(stat => {
        if (stat.accuracy < 62) {
            suggestedToDisable.push(stat.league);
        }
    });
    
    // Also add known hardcoded chaotic ones just to be safe if they aren't in performance metrics yet
    const chaotic = ['MLS', 'Championship', 'Turkish Super Lig', 'Liga MX', 'Ligue 2', 'Serie B', 'Scottish Premiership', 'Austrian Bundesliga'];
    chaotic.forEach(c => {
        if (!suggestedToDisable.includes(c)) suggestedToDisable.push(c);
    });

    setDisabledLeagues(suggestedToDisable);
  };

  const handleSaveBlacklistOnly = async (leaguesToSave = disabledLeagues) => {
    setIsSavingBlacklist(true);
    try {
      const updated = {
        homeAdvantage: parseFloat(homeAdvantage),
        dixonColesRho: parseFloat(dixonColesRho),
        eloKFactor: parseFloat(eloKFactor),
        fatiguePenalty: parseFloat(fatiguePenalty),
        kellyFraction: parseFloat(kellyFraction),
        minConfidenceThreshold: parseFloat(minConfidenceThreshold),
        ...tuningConfig,
        disabledLeagues: leaguesToSave
      };
      if (onSaveTuning) {
        await onSaveTuning(updated);
      }
      if (onRefreshState) {
        await onRefreshState();
      }
      setBlacklistSavedSuccess(true);
      setTimeout(() => setBlacklistSavedSuccess(false), 4000);
    } catch (e) {
      console.error("Failed to save blacklist:", e);
    } finally {
      setIsSavingBlacklist(false);
    }
  };

  const handleSave = async () => {
    const updated = {
      homeAdvantage: parseFloat(homeAdvantage),
      homeEloBoost: parseFloat(homeEloBoost),
      entropyFloorThreshold: parseFloat(entropyFloorThreshold),
      paritySafetyThreshold: parseFloat(paritySafetyThreshold),
      highDrawFloor: parseFloat(highDrawFloor),
      dixonColesRho: parseFloat(dixonColesRho),
      eloKFactor: parseFloat(eloKFactor),
      fatiguePenalty: parseFloat(fatiguePenalty),
      kellyFraction: parseFloat(kellyFraction),
      minConfidenceThreshold: parseFloat(minConfidenceThreshold),
      disabledLeagues: disabledLeagues
    };
    if (onSaveTuning) {
      await onSaveTuning(updated);
    }
    if (onRefreshState) {
      await onRefreshState();
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base">
              Statistical &amp; Dixon-Coles Hyperparameters
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live mathematical parameters governing scoring rate adjustments, goal dependency, and Kelly sizing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <UniformDropdown
            label="Preset"
            value="CUSTOM"
            onChange={handleApplyPreset}
            options={[
              { value: 'DEFAULT', label: 'Default Production' },
              { value: 'CONSERVATIVE', label: 'Conservative (Low Variance)' },
              { value: 'AGGRESSIVE', label: 'Aggressive / High Value' },
              { value: 'CUSTOM', label: 'Custom Configuration' }
            ]}
          />
        </div>
      </div>

      {/* Parameter Cards in Compact Layout */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          {/* Home Advantage */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">Home Advantage Offset (Goals)</label>
              <span className="font-mono font-bold text-indigo-700">{homeAdvantage}</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.50"
              step="0.01"
              value={homeAdvantage}
              onChange={(e) => setHomeAdvantage(e.target.value)}
              className="w-full accent-indigo-600"
            />
            <p className="text-[11px] text-slate-500">
              Additive boost to home team expected goals (xG).
            </p>
          </div>

          {/* Dixon-Coles Rho */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">Dixon-Coles Rho (Low-Score Corr)</label>
              <span className="font-mono font-bold text-indigo-700">{dixonColesRho}</span>
            </div>
            <input
              type="range"
              min="-0.30"
              max="0.00"
              step="0.01"
              value={dixonColesRho}
              onChange={(e) => setDixonColesRho(e.target.value)}
              className="w-full accent-indigo-600"
            />
            <p className="text-[11px] text-slate-500">
              Corrects standard independent Statistical for 0-0, 1-0, 0-1, and 1-1 scores.
            </p>
          </div>

          {/* Elo K-Factor */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">Elo Updating K-Factor</label>
              <span className="font-mono font-bold text-indigo-700">{eloKFactor}</span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              step="1"
              value={eloKFactor}
              onChange={(e) => setEloKFactor(e.target.value)}
              className="w-full accent-indigo-600"
            />
            <p className="text-[11px] text-slate-500">
              Sensitivity of team rating changes per match outcome.
            </p>
          </div>

          {/* Kelly Safety Fraction */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <KellyTooltip align="left">
                <label className="font-bold text-slate-800 cursor-help flex items-center gap-1">
                  <span>Bet Size Safety Factor (Kelly)</span>
                </label>
              </KellyTooltip>
              <span className="font-mono font-bold text-indigo-700">{kellyFraction}x</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.50"
              step="0.05"
              value={kellyFraction}
              onChange={(e) => setKellyFraction(e.target.value)}
              className="w-full accent-indigo-600"
            />
            <p className="text-[11px] text-slate-500">
              Fractional scaling (0.25 = quarter Kelly for conservative bankroll protection).
            </p>
          </div>

        </div>

      </div>

      {/* Parity, Entropy & Draw Safety Protections */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800">Parity, Entropy &amp; Draw Shields</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                Active Protections
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Calibrated defense against coin-flip 1X2 traps, compressed-league variance, and draw leakages
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          {/* Base Home Elo Boost */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">Tiered Home Elo Calibration (Base)</label>
              <span className="font-mono font-bold text-emerald-700">+{homeEloBoost} Elo</span>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              value={homeEloBoost}
              onChange={(e) => setHomeEloBoost(e.target.value)}
              className="w-full accent-emerald-600"
            />
            <p className="text-[11px] text-slate-500">
              Dynamically scales home advantage by league tier (Tier 1: ~{Math.round(homeEloBoost * 0.9)} Elo, Parity/Lower: ~{Math.round(homeEloBoost * 0.48)} Elo).
            </p>
          </div>

          {/* Entropy Floor Threshold */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">Entropy Floor (Min Win Probability)</label>
              <span className="font-mono font-bold text-emerald-700">{entropyFloorThreshold}%</span>
            </div>
            <input
              type="range"
              min="48.0"
              max="60.0"
              step="0.5"
              value={entropyFloorThreshold}
              onChange={(e) => setEntropyFloorThreshold(e.target.value)}
              className="w-full accent-emerald-600"
            />
            <p className="text-[11px] text-slate-500">
              Strictly disallows straight win picks below this threshold, preventing coin-flip selections.
            </p>
          </div>

          {/* Parity Safety Threshold */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">Parity League High-Conviction Floor</label>
              <span className="font-mono font-bold text-emerald-700">{paritySafetyThreshold}%</span>
            </div>
            <input
              type="range"
              min="60.0"
              max="78.0"
              step="1.0"
              value={paritySafetyThreshold}
              onChange={(e) => setParitySafetyThreshold(e.target.value)}
              className="w-full accent-emerald-600"
            />
            <p className="text-[11px] text-slate-500">
              Fixtures in compressed leagues (Championship, MLS, League Two) require &ge;{paritySafetyThreshold}% to qualify for straight win picks or elite parlays.
            </p>
          </div>

          {/* High-Draw Smart Market Trigger */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">High-Draw Smart Double Chance Floor</label>
              <span className="font-mono font-bold text-emerald-700">{highDrawFloor}%</span>
            </div>
            <input
              type="range"
              min="20.0"
              max="32.0"
              step="1.0"
              value={highDrawFloor}
              onChange={(e) => setHighDrawFloor(e.target.value)}
              className="w-full accent-emerald-600"
            />
            <p className="text-[11px] text-slate-500">
              When projected draw probability is &ge;{highDrawFloor}%, the engine routes recommendations to Double Chance (1X / X2) or Draw-No-Bet.
            </p>
          </div>

        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-center font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">Disabled / Blacklisted Leagues</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  {disabledLeagues.length} Excluded
                </span>
              </div>
              <p className="text-xs text-slate-500">Blacklisted leagues are purged from top picks and excluded from accuracy &amp; unanimous proof rates</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleAiAutoFilter}
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Auto-Filter (&lt;62%)
            </button>

            {/* DEDICATED PRIMARY SAVE BUTTON IN CARD HEADER */}
            <button
              onClick={() => handleSaveBlacklistOnly()}
              disabled={isSavingBlacklist || isSaving}
              type="button"
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSavingBlacklist ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : blacklistSavedSuccess ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>
                {blacklistSavedSuccess ? 'Saved & Refreshed!' : isSavingBlacklist ? 'Recalculating Model...' : 'Save Blacklisted Leagues'}
              </span>
            </button>
          </div>
        </div>

        {/* PROMINENT SUCCESS NOTIFICATION */}
        {blacklistSavedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span><strong>League blacklist saved successfully!</strong> Model accuracy, unanimous rates, and system filters have been fully refreshed across the entire app.</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Synchronized</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 block">
              Toggle leagues to blacklist from predictions &amp; model calculations
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const below60 = (state.trainingStats?.leaguePerformance || [])
                    .filter(s => s.accuracy < 60)
                    .map(s => s.league);
                  setDisabledLeagues(prev => Array.from(new Set([...prev, ...below60])));
                }}
                className="text-[11px] text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                Select &lt;60% Accuracy
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setDisabledLeagues([])}
                className="text-[11px] text-red-600 hover:text-red-700 underline cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2">
            {[...(state.trainingStats?.leaguePerformance || [])].sort((a,b) => a.accuracy - b.accuracy).map((leagueStat) => {
              const isDisabled = disabledLeagues.includes(leagueStat.league);
              const colorClass = leagueStat.accuracy >= 75 ? 'text-emerald-600' : leagueStat.accuracy < 60 ? 'text-red-600' : 'text-amber-600';
              return (
                <label 
                  key={leagueStat.league} 
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isDisabled ? 'bg-red-50 border-red-300 shadow-xs' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    checked={isDisabled}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDisabledLeagues(prev => [...prev, leagueStat.league]);
                      } else {
                        setDisabledLeagues(prev => prev.filter(l => l !== leagueStat.league));
                      }
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-800 truncate">{leagueStat.league}</span>
                      {isDisabled && (
                        <span className="text-[9px] font-bold bg-red-200 text-red-800 px-1.5 py-0.5 rounded">
                          BLACKLISTED
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-[10px] text-slate-500">{leagueStat.correct}/{leagueStat.total} Hits</span>
                      <span className={`text-[10px] font-bold ${colorClass}`}>{leagueStat.accuracy}%</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* DEDICATED SAVE BUTTON IN CARD FOOTER */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Note: Saving immediately updates model accuracy, recalculates the swarm unanimous rate, and passes all blacklisted fixtures.
            </p>
            <button
              onClick={() => handleSaveBlacklistOnly()}
              disabled={isSavingBlacklist || isSaving}
              type="button"
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 ml-auto"
            >
              {isSavingBlacklist ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSavingBlacklist ? 'Recalculating App...' : 'Save Blacklist & Refresh App'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Timezone & Localization Preferences Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Timezone & Clock Display</h2>
              <p className="text-xs text-slate-500">Synchronize match kickoff times and log stamps to your region</p>
            </div>
          </div>
          {tzSavedSuccess && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Display Timezone</label>
            <UniformDropdown
              label="Zone"
              value={selectedZone}
              onChange={(val) => {
                setSelectedZone(val);
                if (typeof onUpdateTzSettings === 'function') {
                  onUpdateTzSettings({ zone: val, hour24: hourFormat === '24' });
                  setTzSavedSuccess(true);
                  setTimeout(() => setTzSavedSuccess(false), 2000);
                }
              }}
              options={timezoneOptions}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Clock Format</label>
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setHourFormat('12');
                  if (typeof onUpdateTzSettings === 'function') {
                    onUpdateTzSettings({ zone: selectedZone, hour24: false });
                    setTzSavedSuccess(true);
                    setTimeout(() => setTzSavedSuccess(false), 2000);
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  hourFormat === '12'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                12-Hour (1:30 PM)
              </button>
              <button
                type="button"
                onClick={() => {
                  setHourFormat('24');
                  if (typeof onUpdateTzSettings === 'function') {
                    onUpdateTzSettings({ zone: selectedZone, hour24: true });
                    setTzSavedSuccess(true);
                    setTimeout(() => setTzSavedSuccess(false), 2000);
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  hourFormat === '24'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                24-Hour (13:30)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Action Bottom Bar */}
      <div className="sticky bottom-4 mt-6 mx-auto w-full max-w-lg bg-slate-900 shadow-xl rounded-2xl p-3 border border-slate-700 flex items-center justify-between z-50">
        <button
          onClick={() => handleApplyPreset('DEFAULT')}
          className="px-4 py-2 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset Defaults</span>
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm transition-all cursor-pointer flex items-center gap-2 shadow-lg disabled:opacity-50"
        >
          {savedSuccess ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          <span>{savedSuccess ? 'Saved!' : isSaving ? 'Saving...' : 'Save All Settings'}</span>
        </button>
      </div>

    </div>
  );
}
