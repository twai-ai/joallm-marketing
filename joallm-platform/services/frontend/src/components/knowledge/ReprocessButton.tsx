import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../../utils/api-client';
import { showSuccess, showError } from '../../utils/toast';

interface ReprocessButtonProps {
  fileId: string;
  filename: string;
  onReprocessComplete?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function ReprocessButton({ 
  fileId, 
  filename, 
  onReprocessComplete,
  size = 'md',
  variant = 'secondary'
}: ReprocessButtonProps) {
  const [isReprocessing, setIsReprocessing] = useState(false);

  const handleReprocess = async () => {
    if (!confirm(`Reprocess "${filename}"? This will regenerate embeddings and make it searchable.`)) {
      return;
    }

    setIsReprocessing(true);
    
    try {
      const response = await apiClient.post(`/api/files/${fileId}/reprocess`);
      
      showSuccess(`Started reprocessing "${filename}". Check back in 10-20 seconds.`);
      
      if (onReprocessComplete) {
        // Wait a bit for the status to update
        setTimeout(() => {
          onReprocessComplete();
        }, 2000);
      }
      
    } catch (error) {
      console.error('Reprocess failed:', error);
      showError(`Failed to reprocess file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsReprocessing(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const variantClasses = {
    primary: 'bg-joa-primary hover:bg-joa-primary-dark text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300',
    ghost: 'hover:bg-gray-100 text-gray-600'
  };

  return (
    <button
      onClick={handleReprocess}
      disabled={isReprocessing}
      className={`
        inline-flex items-center gap-1.5 rounded-lg font-medium
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
      `}
      title="Reprocess file to generate embeddings and make it searchable"
    >
      <RefreshCw className={`w-4 h-4 ${isReprocessing ? 'animate-spin' : ''}`} />
      <span>{isReprocessing ? 'Reprocessing...' : 'Reprocess'}</span>
    </button>
  );
}

