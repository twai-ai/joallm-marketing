import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Database, Workflow, BookOpen, Brain, Zap, 
  Search, Book, FileText, BarChart3, Settings, ArrowRight,
  Sparkles, Target, Lock, TrendingUp, Code, Layers
} from 'lucide-react';
import { StandaloneLogo } from '../components/ui/Logo';

export function WelcomePage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: MessageSquare,
      title: 'Intelligent Chat',
      description: 'Natural conversations with multiple AI models',
      benefits: ['GPT-4 Turbo', 'Claude 3', 'Real-time Streaming', 'Session Management'],
      route: '/chat',
      color: 'bg-blue-50 text-blue-600'
    },
    {
      icon: Search,
      title: 'Knowledge Base',
      description: 'Chat with your documents using RAG',
      benefits: ['PDF, DOCX Support', 'Vector Search', 'Semantic Analysis', 'Document Management'],
      route: '/rag-search',
      color: 'bg-purple-50 text-purple-600'
    },
    {
      icon: Workflow,
      title: 'Workflow Builder',
      description: 'Create automated AI workflows visually',
      benefits: ['Visual Builder', 'Node-based Logic', 'Conditional Flows', 'Batch Processing'],
      route: '/workflow',
      color: 'bg-green-50 text-green-600'
    },
    {
      icon: BookOpen,
      title: 'Interactive Notebooks',
      description: 'Data analysis and AI experimentation',
      benefits: ['Python Runtime', 'Data Viz', 'AI Integration', 'Export Options'],
      route: '/notebook',
      color: 'bg-orange-50 text-orange-600'
    },
    {
      icon: Database,
      title: 'Model Library',
      description: 'Explore all available AI models',
      benefits: ['Multi-Provider', 'Model Comparison', 'Smart Routing', 'Cost Optimization'],
      route: '/farm',
      color: 'bg-pink-50 text-pink-600'
    },
    {
      icon: Book,
      title: 'Documentation',
      description: 'Work in Progress & Planning',
      benefits: ['Implementation Status', 'Feature Docs', 'API Reference', 'Guides'],
      route: '/docs',
      color: 'bg-indigo-50 text-indigo-600'
    }
  ];

  const capabilities = [
    {
      icon: Brain,
      title: 'Multi-LLM Support',
      description: 'Access multiple AI models from one platform'
    },
    {
      icon: Layers,
      title: 'RAG Integration',
      description: 'Intelligent document search and context'
    },
    {
      icon: Zap,
      title: 'Real-time Processing',
      description: 'Streaming responses for instant feedback'
    },
    {
      icon: Target,
      title: 'Role-Based Access',
      description: 'Tailored experiences for different users'
    },
    {
      icon: BarChart3,
      title: 'Analytics & Monitoring',
      description: 'Track usage, performance, and costs'
    },
    {
      icon: Lock,
      title: 'Enterprise Ready',
      description: 'Secure and scalable for teams'
    }
  ];

  const quickPrompts = [
    "Explain quantum computing in simple terms",
    "Help me write a professional email",
    "Analyze this data and create insights",
    "Create a Python script for data processing"
  ];

  return (
    <div className="min-h-screen bg-joa-bg overflow-y-auto">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <StandaloneLogo />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
              Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-joa-primary to-purple-600">AI Command Center</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the future of AI with our comprehensive platform that combines 
              multi-LLM support, RAG capabilities, workflow automation, and intelligent features.
            </p>
            
            {/* Quick Actions */}
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <button
                onClick={() => navigate('/chat')}
                className="btn-primary flex items-center gap-2"
              >
                <MessageSquare className="w-5 h-5" />
                Start Chatting
              </button>
              <button
                onClick={() => navigate('/rag-search')}
                className="btn-secondary flex items-center gap-2"
              >
                <Search className="w-5 h-5" />
                Explore Knowledge Base
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything You Need
          </h2>
          <p className="text-lg text-gray-600">
            Powerful tools for AI-powered workflows
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-200 hover:border-joa-primary hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
              onClick={() => navigate(feature.route)}
            >
              <div className="p-6">
                {/* Icon */}
                <div className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6" />
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 mb-4">
                  {feature.description}
                </p>

                {/* Benefits */}
                <div className="space-y-2 mb-4">
                  {feature.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-center text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-joa-primary rounded-full mr-2"></div>
                      {benefit}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center text-joa-primary font-medium text-sm group-hover:translate-x-2 transition-transform">
                  Explore <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Platform Capabilities
            </h2>
            <p className="text-lg text-gray-600">
              Built for modern AI workflows
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((capability, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-joa-primary bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <capability.icon className="w-6 h-6 text-joa-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {capability.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {capability.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Start Section */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-joa-primary to-purple-600 rounded-2xl p-8 md:p-12 text-white">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg opacity-90">
              Try one of these quick prompts to get started
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickPrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => {
                  navigate('/chat');
                  // Store prompt for the chat interface to use
                  setTimeout(() => {
                    const event = new CustomEvent('quick-prompt', { detail: prompt });
                    window.dispatchEvent(event);
                  }, 100);
                }}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-left transition-all border border-white border-opacity-30 hover:border-opacity-50"
              >
                <div className="flex items-start space-x-3">
                  <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{prompt}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => navigate('/chat')}
              className="bg-white text-joa-primary px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start New Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
