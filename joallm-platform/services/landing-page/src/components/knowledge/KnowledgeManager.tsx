import React, { useState } from 'react';
import { X, Upload, File, Search, Trash2, Download, Eye } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'txt' | 'docx' | 'csv';
  size: string;
  uploaded: Date;
  status: 'processing' | 'indexed' | 'failed';
  chunks?: number;
}

interface KnowledgeManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KnowledgeManager({ isOpen, onClose }: KnowledgeManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: '1',
      name: 'Company_Handbook_2024.pdf',
      type: 'pdf',
      size: '2.3 MB',
      uploaded: new Date('2024-01-15'),
      status: 'indexed',
      chunks: 45,
    },
    {
      id: '2',
      name: 'Product_Specifications.docx',
      type: 'docx',
      size: '1.1 MB',
      uploaded: new Date('2024-01-14'),
      status: 'indexed',
      chunks: 23,
    },
    {
      id: '3',
      name: 'Sales_Data_Q4.csv',
      type: 'csv',
      size: '876 KB',
      uploaded: new Date('2024-01-13'),
      status: 'processing',
    },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: Document['status']) => {
    switch (status) {
      case 'indexed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
    }
  };

  const getFileIcon = (type: Document['type']) => {
    // In a real app, you'd use different icons for different file types
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const newDoc: Document = {
        id: Date.now().toString(),
        name: file.name,
        type: file.name.split('.').pop() as Document['type'],
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        uploaded: new Date(),
        status: 'processing',
      };
      setDocuments(prev => [newDoc, ...prev]);
    });
  };

  const handleDelete = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
    setSelectedDocuments(prev => prev.filter(docId => docId !== id));
  };

  const handleSelectDocument = (id: string) => {
    setSelectedDocuments(prev =>
      prev.includes(id)
        ? prev.filter(docId => docId !== id)
        : [...prev, id]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">joallm.ai Knowledge Base</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage your documents and data sources for multi-model AI context
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                type="file"
                multiple
                accept=".pdf,.txt,.docx,.csv,.md"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Documents</span>
              </label>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="text-sm text-gray-600">
            {documents.length} documents • {selectedDocuments.length} selected
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {filteredDocuments.map((document) => (
              <div
                key={document.id}
                className={`flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                  selectedDocuments.includes(document.id) ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDocuments.includes(document.id)}
                  onChange={() => handleSelectDocument(document.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />

                <div className="flex-shrink-0">
                  {getFileIcon(document.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {document.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(document.status)}`}>
                      {document.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                    <span>{document.size}</span>
                    <span>•</span>
                    <span>{document.uploaded.toLocaleDateString()}</span>
                    {document.chunks && (
                      <>
                        <span>•</span>
                        <span>{document.chunks} chunks</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View document"
                  >
                    <Eye className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  <button
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Download document"
                  >
                    <Download className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  <button
                    onClick={() => handleDelete(document.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <File className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'Try adjusting your search terms' : 'Upload documents to get started with AI-powered analysis'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              💡 Supported formats: PDF, DOCX, TXT, CSV, Markdown
            </div>
            
            <div className="flex items-center space-x-3">
              {selectedDocuments.length > 0 && (
                <button
                  onClick={() => {
                    selectedDocuments.forEach(handleDelete);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Selected</span>
                </button>
              )}
              
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}