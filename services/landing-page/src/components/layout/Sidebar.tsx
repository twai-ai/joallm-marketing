import React, { useState } from 'react';
import { MessageSquare, BookOpen, Workflow, X, Plus, History, Bookmark, Users, Zap, Home, Lightbulb, FileText, Code, BarChart3, Database, Settings, Command, Book, Search } from 'lucide-react';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { SidebarLogo } from '../ui/Logo';
import type { ViewMode } from '../../App';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onQuickPrompt?: (prompt: string) => void;
  onOpenKnowledge?: () => void;
}

export function Sidebar({ isOpen, onToggle, currentView, onViewChange, onQuickPrompt, onOpenKnowledge }: SidebarProps) {
  const { getRoleConfig } = useUserRole();
  const roleConfig = getRoleConfig();
  const [activeSection, setActiveSection] = useState<'welcome' | 'llm-hub' | 'chat' | 'notebook' | 'workflow' | 'farm' | 'docs'>('llm-hub');

  const quickPrompts = [
    { icon: Lightbulb, text: "Explain quantum computing in simple terms", category: "Learning" },
    { icon: FileText, text: "Help me write a professional email", category: "Writing" },
    { icon: Code, text: "Debug this Python function", category: "Programming" },
    { icon: BarChart3, text: "Analyze this data and create insights", category: "Analysis" }
  ];

  const mainNavigation = [
    { id: 'welcome' as ViewMode, icon: Home, label: 'Welcome', description: 'Platform overview and features' },
    { id: 'chat' as ViewMode, icon: MessageSquare, label: 'Chat', description: 'AI conversations and Q&A' },
    { id: 'rag-search' as ViewMode, icon: Search, label: 'Knowledge Base', description: 'Chat, Search & Manage Documents' },
    { id: 'notebook' as ViewMode, icon: BookOpen, label: 'Notebook', description: 'Interactive data analysis' },
    { id: 'workflow' as ViewMode, icon: Workflow, label: 'Workflow Builder', description: 'Automated AI workflows' },
    { id: 'farm' as ViewMode, icon: Database, label: 'Model Library', description: 'Explore all available AI models' },
    { id: 'docs' as ViewMode, icon: Book, label: 'Documentation', description: 'Work in Progress & Planning' },
  ];

  const quickActions = [
    { icon: History, label: 'Recent Chats', action: () => {} },
    { icon: Bookmark, label: 'Saved Items', action: () => {} },
    { icon: Settings, label: 'Settings', action: () => {} },
  ];

  const handleViewChange = (view: ViewMode) => {
    onViewChange(view);
    // Keep sidebar on LLM Hub for rag-search, farm, and docs views
    // These views have their own navigation
    if (view === 'rag-search' || view === 'farm' || view === 'docs' || view === 'welcome') {
      setActiveSection('llm-hub');
    } else {
      setActiveSection(view);
    }
    // Close sidebar after navigation to give full screen to the tool
    onToggle();
  };

  const handleQuickPrompt = (prompt: string) => {
    if (onQuickPrompt) {
      onQuickPrompt(prompt);
      setActiveSection('chat');
      onViewChange('chat');
      // Close sidebar after navigation to give full screen to the tool
      onToggle();
    }
  };

  if (!isOpen) {
    return null; // Completely hide when closed
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-in fade-in duration-200"
        onClick={onToggle}
      />
      
      {/* Sidebar */}
      <div className="fixed lg:relative inset-y-0 left-0 w-80 bg-gray-900 text-white flex flex-col z-50 shadow-xl animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <SidebarLogo />
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-gray-800 transition-colors"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* LLM Hub Section */}
        {activeSection === 'llm-hub' && (
          <div className="flex-1 overflow-y-auto">
            {/* Welcome Section */}
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-2">LLM Hub</h2>
              <p className="text-sm text-gray-400">Your command center for LLM-powered work</p>
            </div>

            {/* Main Navigation Cards */}
            <div className="p-4 space-y-3">
              {mainNavigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleViewChange(item.id)}
                  className={`w-full p-4 rounded-lg transition-colors text-left group ${
                    currentView === item.id 
                      ? 'bg-joa-primary text-white' 
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      currentView === item.id
                        ? 'bg-white bg-opacity-20'
                        : 'bg-joa-primary bg-opacity-20 group-hover:bg-opacity-30'
                    }`}>
                      <item.icon className={`w-5 h-5 ${
                        currentView === item.id ? 'text-white' : 'text-joa-primary'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{item.label}</h3>
                      <p className={`text-xs ${
                        currentView === item.id ? 'text-white text-opacity-80' : 'text-gray-400'
                      }`}>{item.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Quick Prompts */}
            <div className="p-4 border-t border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Start</h3>
              <div className="space-y-2">
                {quickPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickPrompt(prompt.text)}
                    className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-700 group-hover:bg-joa-primary group-hover:bg-opacity-20 rounded-lg flex items-center justify-center transition-colors">
                        <prompt.icon className="w-4 h-4 text-gray-400 group-hover:text-joa-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white group-hover:text-joa-primary transition-colors truncate">
                          {prompt.text}
                        </p>
                        <p className="text-xs text-gray-500">{prompt.category}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 border-t border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.action}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-center group"
                  >
                    <action.icon className="w-4 h-4 text-gray-400 group-hover:text-joa-primary mx-auto mb-1" />
                    <p className="text-xs text-gray-400 group-hover:text-white">{action.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat Section */}
        {activeSection === 'chat' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-800">
              <button
                onClick={() => setActiveSection('llm-hub')}
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
              >
                <Command className="w-4 h-4" />
                <span className="text-sm">Back to LLM Hub</span>
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Chat</h3>
              <p className="text-sm text-gray-400 mb-4">Start a conversation with AI</p>
              {/* Chat-specific content can go here */}
            </div>
          </div>
        )}

        {/* Notebook Section */}
        {activeSection === 'notebook' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-800">
              <button
                onClick={() => setActiveSection('llm-hub')}
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
              >
                <Command className="w-4 h-4" />
                <span className="text-sm">Back to LLM Hub</span>
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Notebook</h3>
              <p className="text-sm text-gray-400 mb-4">Interactive data analysis and AI experiments</p>
              {/* Notebook-specific content can go here */}
            </div>
          </div>
        )}

        {/* Workflow Section */}
        {activeSection === 'workflow' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-800">
              <button
                onClick={() => setActiveSection('llm-hub')}
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
              >
                <Command className="w-4 h-4" />
                <span className="text-sm">Back to LLM Hub</span>
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Workflow Builder</h3>
              <p className="text-sm text-gray-400 mb-4">Create automated AI workflows</p>
              {/* Workflow-specific content can go here */}
            </div>
          </div>
        )}

        {/* Welcome Section */}
        {activeSection === 'welcome' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-800">
              <button
                onClick={() => setActiveSection('llm-hub')}
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
              >
                <Command className="w-4 h-4" />
                <span className="text-sm">Back to LLM Hub</span>
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Welcome to ATRISI Marketing</h3>
              <p className="text-sm text-gray-400 mb-4">Your AI Command Center</p>
              
              {/* Quick Overview */}
              <div className="space-y-3 mt-4">
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <Home className="w-4 h-4 text-joa-primary" />
                    <span className="text-sm font-medium text-white">Platform Overview</span>
                  </div>
                  <p className="text-xs text-gray-400">Explore all features and capabilities</p>
                </div>
              </div>
              
              {/* Quick Links */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => handleViewChange('chat')}
                  className="w-full p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
                >
                  <span className="text-sm text-white">Start Chatting →</span>
                </button>
                <button
                  onClick={() => handleViewChange('rag-search')}
                  className="w-full p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
                >
                  <span className="text-sm text-white">Explore Knowledge Base →</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Docs Section */}
        {activeSection === 'docs' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-800">
              <button
                onClick={() => setActiveSection('llm-hub')}
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
              >
                <Command className="w-4 h-4" />
                <span className="text-sm">Back to LLM Hub</span>
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Documentation</h3>
              <p className="text-sm text-gray-400 mb-4">Work in Progress & Planning Documents</p>
              
              {/* Quick Doc Categories */}
              <div className="space-y-2 mt-4">
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-white">Completed</span>
                  </div>
                  <p className="text-xs text-gray-400">All implemented features and fixes</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm font-medium text-white">Work in Progress</span>
                  </div>
                  <p className="text-xs text-gray-400">Currently building and testing</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-white">Planned</span>
                  </div>
                  <p className="text-xs text-gray-400">Future enhancements and features</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Role Indicator */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${roleConfig.color}`} />
            <span className="text-sm text-gray-300">{roleConfig.name}</span>
          </div>
        </div>
      </div>
    </>
  );
}
