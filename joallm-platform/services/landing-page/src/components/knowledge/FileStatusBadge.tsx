import { CheckCircle, Clock, AlertCircle, Loader2, Upload, FileText } from 'lucide-react';

interface FileStatusBadgeProps {
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
  error?: string;
}

export function FileStatusBadge({ status, error }: FileStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'uploaded':
        return {
          icon: Upload,
          label: 'Uploaded',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          description: 'File received, waiting for processing'
        };
      case 'processing':
        return {
          icon: Loader2,
          label: 'Processing',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          description: 'Extracting text and generating embeddings...',
          animated: true
        };
      case 'processed':
        return {
          icon: CheckCircle,
          label: 'Indexed & Searchable',
          color: 'bg-green-100 text-green-800 border-green-200',
          description: 'Ready for search'
        };
      case 'failed':
        return {
          icon: AlertCircle,
          label: 'Failed',
          color: 'bg-red-100 text-red-800 border-red-200',
          description: error || 'Processing failed'
        };
      default:
        return {
          icon: FileText,
          label: 'Unknown',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          description: 'Status unknown'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-1">
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${config.color}`}>
        <Icon className={`w-3.5 h-3.5 ${config.animated ? 'animate-spin' : ''}`} />
        <span>{config.label}</span>
      </div>
      <p className="text-xs text-gray-500 italic">{config.description}</p>
    </div>
  );
}

