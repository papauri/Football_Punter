import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function UniformDropdown({
  label,
  value,
  onChange,
  options = [],
  icon: Icon,
  disabled = false,
  className = '',
  selectClassName = ''
}) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {label && (
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-2 hidden sm:inline">
          {label}:
        </span>
      )}
      <div className="relative inline-block w-full">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
        <select
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          disabled={disabled}
          className={`appearance-none w-full bg-white text-slate-800 text-xs font-semibold border border-slate-300 hover:border-slate-400 rounded-lg shadow-2xs py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
            Icon ? 'pl-8' : 'pl-3'
          } ${selectClassName}`}
        >
          {options.map((opt, idx) => {
            if (opt && opt.group && Array.isArray(opt.options)) {
              return (
                <optgroup key={opt.group || idx} label={opt.group} className="font-bold text-slate-900 bg-slate-100 py-1">
                  {opt.options.map((subOpt) => {
                    const subVal = typeof subOpt === 'object' ? subOpt.value : subOpt;
                    const subText = typeof subOpt === 'object' ? subOpt.label : subOpt;
                    return (
                      <option key={subVal} value={subVal} className="text-slate-800 py-1 bg-white font-medium">
                        {subText}
                      </option>
                    );
                  })}
                </optgroup>
              );
            }
            const val = typeof opt === 'object' ? opt.value : opt;
            const text = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={val} value={val} className="text-slate-800 py-1 font-medium">
                {text}
              </option>
            );
          })}
        </select>
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-slate-400">
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
