import React, { useState } from 'react';
import { MessageSquare, Sparkles, Zap, Brain, ChevronDown, ChevronUp, Lightbulb, FileText, Code, BarChart3 } from 'lucide-react';
import { StandaloneLogo } from '../ui/Logo';
import { PRODUCT_LABELS } from '../../constants/product';

interface WelcomeScreenProps {
  onPromptSelect?: (prompt: string) => void;
}

export function WelcomeScreen({ onPromptSelect }: WelcomeScreenProps) {
  const [showFeatures, setShowFeatures] = useState(false);

  const quickPrompts = [
    { icon: Lightbulb, text: "Explain quantum computing in simple terms", category: "Learning" },
    { icon: FileText, text: "Help me write a professional email", category: "Writing" },
    { icon: Code, text: "Debug this Python function", category: "Programming" },
    { icon: BarChart3, text: "Analyze this data and create insights", category: "Analysis" }
  ];

  const features = [
    {
      icon: MessageSquare,
      title: PRODUCT_LABELS.chat,
      description: 'Grounded conversations across institutional knowledge'
    },
    {
      icon: Brain,
      title: PRODUCT_LABELS.knowledge,
      description: 'Documents, Timelines, and Knowledge Artifacts'
    },
    {
      icon: Zap,
      title: PRODUCT_LABELS.workflows,
      description: 'Media AI, Document AI, Acquisition, Marketing Studio'
    },
    {
      icon: Sparkles,
      title: PRODUCT_LABELS.notebooks,
      description: 'Advanced Platform tooling for interactive sessions'
    }
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-3xl mx-auto text-center">
        {/* Logo - Prominent but not overwhelming */}
        <div className="mb-6">
          <StandaloneLogo />
        </div>

        {/* Main Message - Clean and Direct */}
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Ready to chat with AI?
        </h2>
        <p className="text-gray-600 mb-8">
          Start typing below or try one of these examples
        </p>

        {/* Quick Prompts - Easy to scan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {quickPrompts.map((prompt, index) => (
            <button
              key={index}
              className="group p-4 bg-white rounded-lg border border-gray-200 hover:border-joa-primary hover:shadow-sm transition-all text-left"
              onClick={() => {
                if (onPromptSelect) {
                  onPromptSelect(prompt.text);
                }
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-100 group-hover:bg-joa-primary group-hover:bg-opacity-10 rounded-lg flex items-center justify-center transition-colors">
                  <prompt.icon className="w-4 h-4 text-gray-600 group-hover:text-joa-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-joa-primary transition-colors">
                    {prompt.text}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {prompt.category}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Collapsible Features - Available but not in the way */}
        <div className="border-t border-gray-200 pt-6">
          <button
            onClick={() => setShowFeatures(!showFeatures)}
            className="flex items-center justify-center space-x-2 text-sm text-gray-600 hover:text-joa-primary transition-colors mx-auto"
          >
            <span>Explore all features</span>
            {showFeatures ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showFeatures && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-200">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-100"
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 bg-joa-primary bg-opacity-10 rounded-lg flex items-center justify-center">
                      <feature.icon className="w-4 h-4 text-joa-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600 text-left">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subtle Call to Action */}
        <div className="mt-8 text-xs text-gray-500">
          <p>💡 Tip: Use the sidebar (☰) to access Knowledge Base, Workflows, and Notebooks</p>
        </div>
      </div>
    </div>
  );
}
