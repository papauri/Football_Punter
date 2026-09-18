import React from 'react';
import { safeToFixed } from '../utils/numberUtils';

export default function ConfidenceGauge({ confidence, label = true, size = 'md' }) {
  const conf = Number(confidence) || 0;
  
  // Colors based on thresholds
  let colorClass = 'bg-amber-500';
  let trackClass = 'bg-amber-100';
  let textClass = 'text-amber-700';
  
  if (conf >= 75) {
    colorClass = 'bg-emerald-500';
    trackClass = 'bg-emerald-100';
    textClass = 'text-emerald-700';
  } else if (conf >= 60) {
    colorClass = 'bg-blue-500';
    trackClass = 'bg-blue-100';
    textClass = 'text-blue-700';
  }

  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2';
  const textSz = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <div className="flex flex-col gap-1 w-full min-w-[50px] max-w-[80px]">
      {label && (
        <div className="flex justify-start items-center">
          <span className={`font-mono font-bold ${textSz} ${textClass}`}>
            {safeToFixed(conf, 0)}%
          </span>
        </div>
      )}
      <div className={`w-full ${trackClass} rounded-full overflow-hidden ${heightClass}`}>
        <div 
          className={`${colorClass} h-full rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, conf))}%` }}
        />
      </div>
    </div>
  );
}
