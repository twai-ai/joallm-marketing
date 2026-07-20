import React, { useState } from 'react';
import { Download, FileText, FileJson, File, Lock } from 'lucide-react';
import { Message } from '../../types';
import { exportChatAsMarkdown, exportChatAsJSON, exportChatAsText } from '../../utils/exportChat';
import { showSuccess } from '../../utils/toast';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';

interface ExportMenuProps {
  messages: Message[];
  sessionTitle: string;
}

export function ExportMenu({ messages, sessionTitle }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { limits } = useUserRole();
  const canExport = limits?.canExportData ?? false;

  if (!canExport) {
    return (
      <div className="relative group">
        <button
          disabled
          className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-1.5 text-sm text-gray-400"
          title="Export is available on Pro plan"
        >
          <Lock className="h-4 w-4" />
          <span>Export</span>
        </button>
        <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden w-52 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-lg group-hover:block">
          Chat export requires a Pro subscription.
        </div>
      </div>
    );
  }

  const handleExport = (format: 'markdown' | 'json' | 'text') => {
    switch (format) {
      case 'markdown':
        exportChatAsMarkdown(messages, sessionTitle);
        break;
      case 'json':
        exportChatAsJSON(messages, sessionTitle);
        break;
      case 'text':
        exportChatAsText(messages, sessionTitle);
        break;
    }
    showSuccess(`Exported as ${format.toUpperCase()}`);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
        title="Export conversation"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <button
              onClick={() => handleExport('markdown')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Markdown (.md)</span>
            </button>
            
            <button
              onClick={() => handleExport('json')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FileJson className="w-4 h-4" />
              <span>JSON (.json)</span>
            </button>
            
            <button
              onClick={() => handleExport('text')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <File className="w-4 h-4" />
              <span>Text (.txt)</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}


