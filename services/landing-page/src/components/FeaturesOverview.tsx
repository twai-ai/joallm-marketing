import React from 'react';
import { CheckCircle, Zap, Lock, MessageSquare, Search, BookOpen, Workflow, Database, BarChart3, Upload, Code, Globe } from 'lucide-react';
import { FeatureStatusBadge } from './common/FeatureStatusBadge';

interface FeatureItem {
  name: string;
  status: 'ready' | 'beta' | 'locked';
  icon: React.ElementType;
  description: string;
  metrics?: string;
}

const availableFeatures: FeatureItem[] = [
  {
    name: 'Multi-Model Chat',
    status: 'ready',
    icon: MessageSquare,
    description: 'Chat with 20+ AI models from 4 providers',
    metrics: '20+ Models'
  },
  {
    name: 'RAG Search',
    status: 'ready',
    icon: Search,
    description: 'Semantic search across your documents',
    metrics: 'Vector Search'
  },
  {
    name: 'Document Upload',
    status: 'ready',
    icon: Upload,
    description: 'Support for 35+ file formats',
    metrics: '35+ Formats'
  },
  {
    name: 'Session Management',
    status: 'ready',
    icon: Database,
    description: 'Save and resume conversations',
    metrics: 'Persistent'
  },
  {
    name: 'Code Analysis',
    status: 'ready',
    icon: Code,
    description: 'Upload and analyze code files',
    metrics: '15+ Languages'
  },
  {
    name: 'Role-Based Access',
    status: 'ready',
    icon: Globe,
    description: 'Tailored interfaces for different users',
    metrics: '4 User Roles'
  },
];

const betaFeatures: FeatureItem[] = [
  {
    name: 'PDF Processing',
    status: 'beta',
    icon: Upload,
    description: 'Limited text extraction from PDFs',
    metrics: 'Beta'
  },
  {
    name: 'Workflow Builder',
    status: 'beta',
    icon: Workflow,
    description: 'Visual AI workflow creation',
    metrics: 'Node-based'
  },
  {
    name: 'Notebook Interface',
    status: 'beta',
    icon: BookOpen,
    description: 'Jupyter-style document analysis',
    metrics: 'Interactive'
  },
  {
    name: 'RAG Analytics',
    status: 'beta',
    icon: BarChart3,
    description: 'Search performance insights',
    metrics: 'Metrics'
  },
];

const comingSoonFeatures: FeatureItem[] = [
  {
    name: 'Excel Support',
    status: 'locked',
    icon: Upload,
    description: 'Spreadsheet analysis and search',
    metrics: 'Q1 2025'
  },
  {
    name: 'PowerPoint Support',
    status: 'locked',
    icon: Upload,
    description: 'Presentation content extraction',
    metrics: 'Q1 2025'
  },
  {
    name: 'Advanced OCR',
    status: 'locked',
    icon: Search,
    description: 'Text extraction from images',
    metrics: 'Q2 2025'
  },
  {
    name: 'Multi-language Support',
    status: 'locked',
    icon: Globe,
    description: 'Interface in multiple languages',
    metrics: 'Q2 2025'
  },
];

export function FeaturesOverview() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Complete Feature Overview
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore all features with transparent status indicators
          </p>
        </div>

        {/* Available Now */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="text-2xl font-bold text-gray-900">Available Now</h3>
            <span className="text-sm text-gray-500 bg-green-100 px-3 py-1 rounded-full">
              {availableFeatures.length} Features
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableFeatures.map((feature, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-green-600" />
                  </div>
                  <FeatureStatusBadge status="ready" size="sm" showTooltip={false} />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{feature.name}</h4>
                <p className="text-sm text-gray-600 mb-3">{feature.description}</p>
                {feature.metrics && (
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
                    {feature.metrics}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Beta Features */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-yellow-600" />
            <h3 className="text-2xl font-bold text-gray-900">Beta Features</h3>
            <span className="text-sm text-gray-500 bg-yellow-100 px-3 py-1 rounded-full">
              {betaFeatures.length} Features
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {betaFeatures.map((feature, idx) => (
              <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-yellow-600" />
                  </div>
                  <FeatureStatusBadge status="beta" size="sm" showTooltip={false} />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{feature.name}</h4>
                <p className="text-sm text-gray-600 mb-3">{feature.description}</p>
                {feature.metrics && (
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                    {feature.metrics}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Coming Soon */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-6 h-6 text-gray-600" />
            <h3 className="text-2xl font-bold text-gray-900">Coming Soon</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {comingSoonFeatures.length} Features
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {comingSoonFeatures.map((feature, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-6 opacity-75">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-gray-500" />
                  </div>
                  <FeatureStatusBadge status="locked" size="sm" showTooltip={false} />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{feature.name}</h4>
                <p className="text-sm text-gray-600 mb-3">{feature.description}</p>
                {feature.metrics && (
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {feature.metrics}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-16 bg-gradient-to-r from-joa-primary to-red-700 rounded-2xl p-8 text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">{availableFeatures.length}</div>
              <div className="text-red-100">Ready Features</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">{betaFeatures.length}</div>
              <div className="text-red-100">Beta Features</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">{comingSoonFeatures.length}</div>
              <div className="text-red-100">In Development</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">{availableFeatures.length + betaFeatures.length + comingSoonFeatures.length}</div>
              <div className="text-red-100">Total Roadmap</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

