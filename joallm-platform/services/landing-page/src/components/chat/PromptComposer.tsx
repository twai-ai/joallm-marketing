import React, { useRef, useEffect, useState } from 'react';
import { Send, Image, Paperclip, Mic, Variable, Sparkles, FileText, ChevronDown, X, Database, Upload } from 'lucide-react';

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  isLoading: boolean;
  placeholder?: string;
  onAttachFile?: () => void;
  onRAGContext?: () => void;
  hasAttachments?: boolean;
  hasRAGContext?: boolean;
}

const PROMPT_TEMPLATES = [
  {
    name: 'Data Analysis',
    template: 'Analyze the following data and provide insights:\n\n{data}\n\nPlease include:\n- Key trends and patterns\n- Statistical summary\n- Actionable recommendations'
  },
  {
    name: 'Code Review',
    template: 'Review this code for best practices and potential improvements:\n\n```\n{code}\n```\n\nFocus on:\n- Code quality and readability\n- Performance optimizations\n- Security considerations\n- Best practices adherence'
  },
  {
    name: 'Content Creation',
    template: 'Create engaging content about: {topic}\n\nTarget audience: {audience}\nTone: {tone}\nLength: {length}\n\nInclude:\n- Compelling headline\n- Clear structure\n- Call-to-action'
  },
  {
    name: 'Problem Solving',
    template: 'Help me solve this problem: {problem}\n\nContext: {context}\nConstraints: {constraints}\n\nPlease provide:\n- Multiple solution approaches\n- Pros and cons of each\n- Recommended implementation steps'
  },
  {
    name: 'Research Summary',
    template: 'Summarize the key findings from this research:\n\n{research_content}\n\nInclude:\n- Main conclusions\n- Supporting evidence\n- Implications and next steps\n- Limitations or gaps'
  }
];

export function PromptComposer({
  value,
  onChange,
  onSend,
  onKeyPress,
  isLoading,
  placeholder = "Type your message...",
  onAttachFile,
  onRAGContext,
  hasAttachments = false,
  hasRAGContext = false
}: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({
    data: '',
    code: '',
    topic: '',
    audience: '',
    tone: '',
    length: '',
    problem: '',
    context: '',
    constraints: '',
    research_content: ''
  });

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [value]);

  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.slice(0, start) + `{${varName}}` + value.slice(end);
      onChange(newValue);
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.setSelectionRange(start + varName.length + 2, start + varName.length + 2);
        textarea.focus();
      }, 0);
    }
  };

  const applyTemplate = (template: string) => {
    let processedTemplate = template;
    
    // Replace variables with their values
    Object.entries(variables).forEach(([key, val]) => {
      if (val.trim()) {
        processedTemplate = processedTemplate.replace(new RegExp(`{${key}}`, 'g'), val);
      }
    });
    
    onChange(processedTemplate);
    setShowTemplates(false);
  };

  const updateVariable = (key: string, val: string) => {
    setVariables(prev => ({ ...prev, [key]: val }));
  };

  const enhancePrompt = () => {
    // Simple prompt enhancement - in real app, this would use AI
    const enhanced = `Please provide a detailed analysis of: ${value}

Consider the following aspects:
- Key insights and observations
- Practical implications
- Recommendations for next steps

Format your response clearly with headings and bullet points where appropriate.`;
    onChange(enhanced);
  };

  return (
    <div className="relative">
      {/* Textarea */}
      <div className="relative border border-gray-300 rounded-lg bg-white shadow-sm focus-within:ring-2 focus-within:ring-joa-primary focus-within:border-joa-primary">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-20 resize-none border-0 rounded-lg focus:outline-none focus:ring-0 min-h-[50px] max-h-[200px]"
          disabled={isLoading}
        />
        
        {/* Action Buttons */}
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          {/* RAG Context Button */}
          {onRAGContext && (
            <button
              onClick={onRAGContext}
              className={`p-2 rounded-md transition-colors ${
                hasRAGContext 
                  ? 'bg-joa-primary text-white' 
                  : 'text-gray-400 hover:text-joa-primary hover:bg-red-50'
              }`}
              title="Add Knowledge Base Context"
            >
              <Database className="w-4 h-4" />
            </button>
          )}

          {/* File Attachment Button */}
          {onAttachFile && (
            <button
              onClick={onAttachFile}
              className={`p-2 rounded-md transition-colors ${
                hasAttachments 
                  ? 'bg-joa-primary text-white' 
                  : 'text-gray-400 hover:text-joa-primary hover:bg-red-50'
              }`}
              title="Attach Files"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}

          {/* Send Button */}
          <button
            onClick={onSend}
            disabled={!value.trim() || isLoading}
            className="p-2 rounded-md bg-joa-primary text-white hover:bg-red-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Templates Dropdown */}
      {showTemplates && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-900">Prompt Templates</h3>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {PROMPT_TEMPLATES.map((template, index) => (
              <button
                key={index}
                onClick={() => applyTemplate(template.template)}
                className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900">{template.name}</div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {template.template.substring(0, 100)}...
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Variables Panel */}
      {showVariables && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Variables</h3>
            <button
              onClick={() => setShowVariables(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto p-3 space-y-3">
            {Object.entries(variables).map(([key, val]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {key.replace('_', ' ')}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => updateVariable(key, e.target.value)}
                    placeholder={`Enter ${key.replace('_', ' ')}...`}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-joa-primary"
                  />
                      <button
                        onClick={() => insertVariable(key)}
                        className="px-2 py-1 text-xs bg-joa-primary text-white rounded hover:bg-red-800"
                      >
                    Insert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}