import React from 'react';
import { CheckCircle, AlertTriangle, Lock, Zap, Clock } from 'lucide-react';

export type FeatureStatus = 'ready' | 'beta' | 'wip' | 'locked' | 'experimental';

interface FeatureStatusBadgeProps {
  status: FeatureStatus;
  customLabel?: string;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FeatureStatusBadge({ 
  status, 
  customLabel,
  showTooltip = true,
  size = 'md',
  className = '' 
}: FeatureStatusBadgeProps) {
  const config = getFeatureStatusConfig(status);
  const Icon = config.icon;
  const label = customLabel || config.label;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };
  
  return (
    <div className="group relative inline-block">
      <div className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.className} ${sizeClasses[size]} ${className}`}>
        <Icon className={iconSizes[size]} />
        <span>{label}</span>
      </div>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-50 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
            <p className="font-semibold mb-1">{config.tooltipTitle}</p>
            <p className="text-gray-300">{config.tooltipText}</p>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getFeatureStatusConfig(status: FeatureStatus) {
  switch (status) {
    case 'ready':
      return {
        icon: CheckCircle,
        label: 'Ready',
        className: 'bg-green-100 text-green-800 border border-green-200',
        tooltipTitle: 'Fully Functional',
        tooltipText: 'This feature is complete, tested, and ready for production use.'
      };
      
    case 'beta':
      return {
        icon: Zap,
        label: 'BETA',
        className: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
        tooltipTitle: 'Beta Feature',
        tooltipText: 'This feature is functional but may have limitations. We\'re actively improving it based on feedback.'
      };
      
    case 'wip':
      return {
        icon: Clock,
        label: 'Work in Progress',
        className: 'bg-blue-100 text-blue-800 border border-blue-200',
        tooltipTitle: 'In Development',
        tooltipText: 'This feature is currently being developed. Some functionality may be incomplete.'
      };
      
    case 'locked':
      return {
        icon: Lock,
        label: 'Coming Soon',
        className: 'bg-gray-100 text-gray-600 border border-gray-300',
        tooltipTitle: 'Locked Feature',
        tooltipText: 'This feature is planned but not yet available. Check back soon!'
      };
      
    case 'experimental':
      return {
        icon: AlertTriangle,
        label: 'Experimental',
        className: 'bg-purple-100 text-purple-800 border border-purple-200',
        tooltipTitle: 'Experimental Feature',
        tooltipText: 'This feature is experimental and may change significantly. Use with caution.'
      };
      
    default:
      return {
        icon: CheckCircle,
        label: 'Ready',
        className: 'bg-green-100 text-green-800 border border-green-200',
        tooltipTitle: 'Ready',
        tooltipText: 'This feature is ready to use.'
      };
  }
}

// Simplified version for headers
export function FeatureStatusTag({ status, size = 'sm' }: { status: FeatureStatus; size?: 'sm' | 'md' }) {
  return <FeatureStatusBadge status={status} size={size} showTooltip={true} />;
}

