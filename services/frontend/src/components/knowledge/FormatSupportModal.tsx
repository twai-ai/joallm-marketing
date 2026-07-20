import React from 'react';
import { X, CheckCircle, AlertCircle, Lock, FileText } from 'lucide-react';
import { FILE_CONFIG } from '../../utils/fileValidation';
import { FileSupportBadge } from '../common/FileSupportBadge';

interface FormatSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FormatSupportModal({ isOpen, onClose }: FormatSupportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">File Format Support</h2>
            <p className="text-sm text-gray-600 mt-1">
              Comprehensive guide to supported file formats and their capabilities
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Fully Supported Formats */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Fully Supported Formats</h3>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 mb-3">
                These formats work perfectly with complete text extraction and search indexing:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {FILE_CONFIG.SUPPORTED_FORMATS.map(format => (
                  <div key={format} className="flex items-center gap-2 text-sm font-mono bg-white px-3 py-2 rounded border border-green-300">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    {format}
                  </div>
                ))}
                {FILE_CONFIG.IMAGE_FORMATS.map(format => (
                  <div key={format} className="flex items-center gap-2 text-sm font-mono bg-white px-3 py-2 rounded border border-green-300">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    {format}
                  </div>
                ))}
                {FILE_CONFIG.CODE_FORMATS.slice(0, 6).map(format => (
                  <div key={format} className="flex items-center gap-2 text-sm font-mono bg-white px-3 py-2 rounded border border-green-300">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    {format}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3">
                ✓ Full text extraction • ✓ Semantic search • ✓ RAG-ready
              </p>
            </div>
          </section>

          {/* Beta Formats */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <h3 className="text-lg font-semibold text-gray-900">Beta Formats</h3>
              <FileSupportBadge status="beta" size="sm" showTooltip={false} />
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 mb-3">
                These formats have limited support. They work but may have incomplete text extraction:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {FILE_CONFIG.BETA_FORMATS.map(format => (
                  <div key={format} className="flex items-center gap-2 text-sm font-mono bg-white px-3 py-2 rounded border border-yellow-300">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    {format}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-yellow-100 rounded">
                <p className="text-xs text-yellow-800 font-medium mb-1">⚠️ Known Limitations:</p>
                <ul className="text-xs text-yellow-700 space-y-1 ml-4">
                  <li>• PDF: Text extraction in development, may miss complex layouts</li>
                  <li>• Search results may be incomplete for these formats</li>
                  <li>• For best results, convert to .docx or .txt</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Coming Soon Formats */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Coming Soon</h3>
              <FileSupportBadge status="coming-soon" size="sm" showTooltip={false} />
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 mb-3">
                These formats are actively being developed:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[...FILE_CONFIG.COMING_SOON_FORMATS, ...FILE_CONFIG.ARCHIVE_FORMATS, ...FILE_CONFIG.EBOOK_FORMATS].map(format => (
                  <div key={format} className="flex items-center gap-2 text-sm font-mono bg-white px-3 py-2 rounded border border-gray-300">
                    <Lock className="w-4 h-4 text-gray-500" />
                    {format}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs text-blue-800 font-medium mb-1">💡 Workaround:</p>
                <ul className="text-xs text-blue-700 space-y-1 ml-4">
                  <li>• <strong>Excel/Spreadsheets:</strong> Export as CSV</li>
                  <li>• <strong>PowerPoint:</strong> Export as PDF or save slides as images</li>
                  <li>• <strong>Archives:</strong> Extract and upload individual files</li>
                  <li>• <strong>Ebooks:</strong> Use calibre to convert to TXT or HTML</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Special Notes */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Special Format Notes</h3>
            
            <div className="space-y-3">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <p className="text-sm font-medium text-blue-900 mb-1">📸 Images</p>
                <p className="text-xs text-blue-800">
                  Images are indexed by filename and metadata only. Text within images is not extracted (OCR coming soon). 
                  For documents with important text in images, consider using an OCR tool first.
                </p>
              </div>

              <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
                <p className="text-sm font-medium text-purple-900 mb-1">💻 Code Files</p>
                <p className="text-xs text-purple-800">
                  Code files are processed as plain text without syntax analysis. Function names and comments are searchable, 
                  but there's no language-specific parsing yet.
                </p>
              </div>

              <div className="bg-green-50 border-l-4 border-green-500 p-4">
                <p className="text-sm font-medium text-green-900 mb-1">📄 Text Files</p>
                <p className="text-xs text-green-800">
                  Plain text files (TXT, MD, CSV, HTML, XML) have the best support with 100% accurate extraction 
                  and are perfect for RAG applications.
                </p>
              </div>
            </div>
          </section>

          {/* File Size Limits */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">File Size Limits</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Knowledge Base Upload</p>
                  <p className="text-2xl font-bold text-joa-primary">50 MB</p>
                  <p className="text-xs text-gray-600 mt-1">Maximum file size per document</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Chat Attachments</p>
                  <p className="text-2xl font-bold text-joa-primary">10 MB</p>
                  <p className="text-xs text-gray-600 mt-1">Maximum file size for chat</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              Need a format that's not supported? <a href="mailto:support@joallm.ai" className="text-joa-primary hover:underline">Contact us</a>
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-joa-primary text-white rounded-lg hover:bg-red-800 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

