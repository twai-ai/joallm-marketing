import React, { useState } from 'react';
import { FileText, ChevronRight, ChevronDown, Search, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface DocItem {
  title: string;
  file: string;
  category: 'completed' | 'in-progress' | 'planned';
  date: string;
  description: string;
}

const docs: DocItem[] = [
  // Work in Progress - Recent Updates
  {
    title: 'LLM Hub Rebranding',
    file: 'LLM_HUB_REBRANDING.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Renamed from AI Hub to LLM Hub for better brand alignment with JoaLLM'
  },
  {
    title: 'Professional Icons Update',
    file: 'PROFESSIONAL_ICONS_UPDATE.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Replaced emoji with Command icon for professional appearance'
  },
  {
    title: 'Sidebar Navigation Fix',
    file: 'SIDEBAR_NAVIGATION_FIX.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Fixed translucent overlay issue when navigating from LLM Hub'
  },
  {
    title: 'LLM Hub Sidebar Design',
    file: 'SIDEBAR_DASHBOARD_DESIGN.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Comprehensive sidebar redesign as navigation and command center'
  },
  {
    title: 'Theme Fixes Complete',
    file: 'THEME_FIXES_COMPLETE.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Fixed all blue components to match JoaLLM brand theme'
  },
  {
    title: 'Hybrid Welcome Screen',
    file: 'HYBRID_WELCOME_SCREEN.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Implemented welcome screen with quick prompt functionality'
  },
  {
    title: 'Responsive Logo Implementation',
    file: 'RESPONSIVE_LOGO_IMPLEMENTED.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Logo component with variations for different sizes and contexts'
  },
  {
    title: 'Brand Theme Implementation',
    file: 'BRAND_THEME_IMPLEMENTED.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Aligned entire UI to JoaLLM logo brand colors'
  },
  {
    title: 'Markdown Rendering',
    file: 'MARKDOWN_RENDERING.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Enhanced markdown rendering with syntax highlighting'
  },
  {
    title: 'Clean Chat Interface',
    file: 'CLEAN_CHAT_COMPLETE.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Reduced clutter in chat interface for better UX'
  },
  {
    title: 'UI Cleanup Complete',
    file: 'UI_CLEANUP_COMPLETE.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Removed unnecessary UI elements and improved layout'
  },
  {
    title: 'Chat Working Guide',
    file: 'CHAT_WORKING_GUIDE.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Fixed chat functionality with streaming support'
  },
  {
    title: 'Hamburger Menu Guide',
    file: 'HAMBURGER_MENU_GUIDE.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Implemented hamburger menu for mobile navigation'
  },
  {
    title: 'Session Summary',
    file: 'SESSION_SUMMARY.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Summary of all session work and achievements'
  },
  {
    title: 'Chat Features Complete',
    file: 'CHAT_FEATURES_COMPLETE.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'All chat features implemented and working'
  },
  {
    title: 'Latest Updates',
    file: 'LATEST_UPDATES.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Most recent changes and improvements'
  },
  {
    title: 'Implementation Summary',
    file: 'IMPLEMENTATION_SUMMARY.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Complete summary of implementation work'
  },
  {
    title: 'Progress Tracker',
    file: 'PROGRESS.md',
    category: 'in-progress',
    date: '2025-10-22',
    description: 'Ongoing progress and feature tracking'
  },
  {
    title: 'Setup Guide',
    file: 'SETUP.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Complete setup instructions for JoaLLM'
  },
  {
    title: 'Commands Reference',
    file: 'COMMANDS.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'All available commands and shortcuts'
  },
  {
    title: 'Fixes Log',
    file: 'FIXES.md',
    category: 'completed',
    date: '2025-10-22',
    description: 'Log of all bugs fixed and issues resolved'
  },
];

export function DocsInterface() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string>('completed');
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);

  const categories = {
    completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
    'in-progress': { label: 'Work in Progress', icon: Clock, color: 'text-yellow-500' },
    planned: { label: 'Planned', icon: AlertCircle, color: 'text-blue-500' }
  };

  const filteredDocs = docs.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedDocs = filteredDocs.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, DocItem[]>);

  const handleDocClick = async (doc: DocItem) => {
    setSelectedDoc(doc);
    // In a real implementation, you would fetch the markdown content here
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar - Doc List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-joa-primary"
            />
          </div>
        </div>

        {/* Doc Categories */}
        <div className="flex-1 overflow-y-auto">
          {Object.entries(categories).map(([key, config]) => {
            const docsInCategory = groupedDocs[key] || [];
            const CategoryIcon = config.icon;
            const isExpanded = expandedCategory === key;

            return (
              <div key={key} className="border-b border-gray-200">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? '' : key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <CategoryIcon className={`w-5 h-5 ${config.color}`} />
                    <span className="font-medium text-gray-900">{config.label}</span>
                    <span className="text-sm text-gray-500">({docsInCategory.length})</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="pb-2">
                    {docsInCategory.map((doc, index) => (
                      <button
                        key={index}
                        onClick={() => handleDocClick(doc)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                          selectedDoc?.file === doc.file ? 'bg-red-50 border-l-4 border-joa-primary' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            selectedDoc?.file === doc.file ? 'text-joa-primary' : 'text-gray-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-medium ${
                              selectedDoc?.file === doc.file ? 'text-red-900' : 'text-gray-900'
                            }`}>
                              {doc.title}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {doc.description}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{doc.date}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content - Doc Viewer */}
      <div className="flex-1 flex flex-col">
        {selectedDoc ? (
          <>
            {/* Doc Header */}
            <div className="bg-white border-b border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedDoc.title}</h1>
                  <p className="text-gray-600">{selectedDoc.description}</p>
                  <div className="flex items-center space-x-4 mt-3">
                    <span className="text-sm text-gray-500">Last updated: {selectedDoc.date}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedDoc.category === 'completed' ? 'bg-green-100 text-green-800' :
                      selectedDoc.category === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {categories[selectedDoc.category].label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Doc Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-lg border border-gray-200 p-8">
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-600 mb-4">
                      Documentation file: <code className="text-sm bg-gray-100 px-2 py-1 rounded">{selectedDoc.file}</code>
                    </p>
                    <p className="text-gray-600">
                      This documentation provides detailed information about {selectedDoc.title.toLowerCase()}.
                      The full markdown content would be loaded here from the file.
                    </p>
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> In a production environment, the full markdown content from <code>{selectedDoc.file}</code> would be rendered here with proper formatting, code highlighting, and navigation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Select a Document
              </h2>
              <p className="text-gray-600">
                Choose a document from the sidebar to view its contents
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


