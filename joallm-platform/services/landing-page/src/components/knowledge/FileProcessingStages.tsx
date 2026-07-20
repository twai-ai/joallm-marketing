import { CheckCircle, Circle, Loader2, AlertCircle } from 'lucide-react';

interface FileProcessingStagesProps {
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
  error?: string;
}

export function FileProcessingStages({ status, error }: FileProcessingStagesProps) {
  const stages = [
    {
      id: 'upload',
      label: 'Upload',
      description: 'File received',
      active: ['uploaded', 'processing', 'processed', 'failed'].includes(status),
      complete: ['processing', 'processed', 'failed'].includes(status),
      error: status === 'failed' && error?.includes('upload')
    },
    {
      id: 'extract',
      label: 'Extract Text',
      description: 'Reading content',
      active: ['processing', 'processed', 'failed'].includes(status),
      complete: ['processed'].includes(status),
      error: status === 'failed' && error?.includes('extract')
    },
    {
      id: 'chunk',
      label: 'Create Chunks',
      description: 'Splitting into sections',
      active: ['processing', 'processed', 'failed'].includes(status),
      complete: ['processed'].includes(status),
      error: status === 'failed' && error?.includes('chunk')
    },
    {
      id: 'embed',
      label: 'Generate Embeddings',
      description: 'Creating search vectors',
      active: ['processing', 'processed', 'failed'].includes(status),
      complete: ['processed'].includes(status),
      error: status === 'failed' && (error?.includes('embed') || error?.includes('index'))
    },
    {
      id: 'index',
      label: 'Indexed',
      description: 'Ready for search',
      active: ['processed'].includes(status),
      complete: ['processed'].includes(status),
      error: false
    },
  ];

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Processing Pipeline</h4>
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const isProcessing = status === 'processing' && stage.active && !stage.complete;
          
          return (
            <div key={stage.id} className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {stage.error ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : stage.complete ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : isProcessing ? (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                ) : stage.active ? (
                  <Circle className="w-5 h-5 text-gray-400 fill-blue-200" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${
                    stage.error ? 'text-red-600' :
                    stage.complete ? 'text-green-600' :
                    isProcessing ? 'text-blue-600' :
                    stage.active ? 'text-gray-700' :
                    'text-gray-400'
                  }`}>
                    {stage.label}
                  </p>
                  {isProcessing && (
                    <span className="text-xs text-blue-600 animate-pulse">In progress...</span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 ${
                  stage.error ? 'text-red-500' :
                  stage.complete ? 'text-green-600' :
                  isProcessing ? 'text-blue-500' :
                  'text-gray-500'
                }`}>
                  {stage.description}
                </p>
              </div>

              {/* Connector Line */}
              {index < stages.length - 1 && (
                <div className="absolute left-[10px] w-0.5 h-6 bg-gray-300 ml-2 mt-6" />
              )}
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {status === 'failed' && error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs font-medium text-red-800 mb-1">Error Details:</p>
          <p className="text-xs text-red-600">{error}</p>
          {error.includes('index row size exceeds') && (
            <p className="text-xs text-red-600 mt-2">
              💡 <strong>Fix:</strong> Database index needs to be updated. Contact admin to run: 
              <code className="bg-red-100 px-1 rounded">/api/admin/fix-vector-index</code>
            </p>
          )}
        </div>
      )}

      {/* Success Message */}
      {status === 'processed' && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            ✅ File is fully processed and searchable!
          </p>
        </div>
      )}
    </div>
  );
}

