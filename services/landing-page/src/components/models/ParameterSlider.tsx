import React from 'react';

interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  description: string;
  icon?: React.ReactNode;
  className?: string;
  formatValue?: (value: number) => string;
}

export function ParameterSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  description,
  icon,
  className = '',
  formatValue = (val) => val.toString()
}: ParameterSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {icon && <div className="text-gray-500">{icon}</div>}
          <label className="text-sm font-medium text-gray-700">{label}</label>
        </div>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">
          {formatValue(value)}
        </span>
      </div>
      
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
          }}
        />
        
        {/* Custom slider thumb */}
        <div
          className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-joa-primary rounded-full shadow-md cursor-pointer"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-400">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
      
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
