import React from 'react';
import { CheckCircle, AlertCircle, Lock, Info } from 'lucide-react';
import type { FormatStatus } from '../../utils/fileValidation';

interface FileSupportBadgeProps {
  status: FormatStatus;
  format?: string;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FileSupportBadge({ 
  status, 
  format, 
  showTooltip = true,
  size = 'md',
  className = '' 
}: FileSupportBadgeProps) {
  const config = getStatusConfig(status, format);
  const Icon = config.icon;
  
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
    <div className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.className} ${sizeClasses[size]} ${className}`}>
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
      {showTooltip && (
        <div className="group relative inline-block">
          <Info className="w-3 h-3 opacity-60 hover:opacity-100 transition-opacity cursor-help" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-50">
            <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
              <p className="font-semibold mb-1">{config.tooltipTitle}</p>
              <p className="text-gray-300">{config.tooltipText}</p>
              {config.action && (
                <p className="mt-2 text-gray-400 italic">{config.action}</p>
              )}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusConfig(status: FormatStatus, format?: string) {
  switch (status) {
    case 'supported':
      return {
        icon: CheckCircle,
        label: 'Fully Supported',
        className: 'bg-green-100 text-green-800 border border-green-200',
        tooltipTitle: 'Fully Supported Format',
        tooltipText: 'This file format is fully supported with complete text extraction and search indexing.',
        action: undefined
      };
      
    case 'beta':
      return {
        icon: AlertCircle,
        label: 'Beta',
        className: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
        tooltipTitle: 'Beta Support',
        tooltipText: format 
          ? `${format} support is in beta. Text extraction may be limited and search results might be incomplete.`
          : 'This format has limited support. Text extraction may be incomplete.',
        action: 'For best results, convert to .docx or .txt'
      };
      
    case 'coming-soon':
      return {
        icon: Lock,
        label: 'Coming Soon',
        className: 'bg-gray-100 text-gray-600 border border-gray-300',
        tooltipTitle: 'In Development',
        tooltipText: format
          ? `${format} support is actively being developed and will be available soon.`
          : 'This format is in active development.',
        action: 'Try converting to a supported format like .docx or .txt'
      };
      
    case 'unsupported':
    default:
      return {
        icon: AlertCircle,
        label: 'Not Supported',
        className: 'bg-red-100 text-red-800 border border-red-200',
        tooltipTitle: 'Unsupported Format',
        tooltipText: 'This file format is not currently supported.',
        action: 'Convert to a supported format: .docx, .txt, .md, etc.'
      };
  }
}

// Alternative compact version for inline use
export function FileSupportIcon({ status, size = 16 }: { status: FormatStatus; size?: number }) {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  
  const colorClasses = {
    supported: 'text-green-600',
    beta: 'text-yellow-600',
    'coming-soon': 'text-gray-500',
    unsupported: 'text-red-600'
  };
  
  return <Icon className={colorClasses[status]} style={{ width: size, height: size }} />;
}

