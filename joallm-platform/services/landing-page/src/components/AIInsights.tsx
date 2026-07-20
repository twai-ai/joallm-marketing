import React from 'react';

export default function AIInsights() {
  return (
    <div className="py-16 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            AI Timeline & Predictions
          </h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">
            Understanding the evolution of artificial intelligence
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* AI Development Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              AI Development Timeline
            </h3>
            <div className="space-y-4">
              <div className="border-l-4 border-joa-primary pl-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Near Term (1-3 years)
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Advanced multimodal AI systems</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Improved reasoning and problem-solving</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Better context understanding</span>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Mid Term (3-5 years)
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Specialized AI agents for complex tasks</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Enhanced human-AI collaboration</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Autonomous decision-making systems</span>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Long Term (5-10 years)
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Advanced reasoning capabilities</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Self-improving AI systems</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">AGI - Artificial General Intelligence (&gt;10 years)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key AI Capabilities */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Key AI Capabilities
            </h3>
            <div className="space-y-4">
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Current State
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Natural Language Processing</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Image and Video Analysis</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Pattern Recognition</span>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-yellow-500 pl-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Emerging Capabilities
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Advanced reasoning and planning</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Multi-step problem solving</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Contextual understanding</span>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-red-500 pl-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Future Predictions
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Computer Vision (&lt;2 years)</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Autonomous agents (2-5 years)</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-joa-primary mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">General intelligence (10+ years)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Insights */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Industry Impact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold text-joa-primary mb-2">Healthcare</h4>
              <p className="text-gray-700 dark:text-gray-300">
                AI-powered diagnostics, drug discovery, and personalized medicine are transforming healthcare delivery.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-joa-primary mb-2">Business</h4>
              <p className="text-gray-700 dark:text-gray-300">
                Automation, predictive analytics, and intelligent decision-making are revolutionizing business operations.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-joa-primary mb-2">Research</h4>
              <p className="text-gray-700 dark:text-gray-300">
                AI accelerates scientific discovery, data analysis, and breakthrough innovations across all fields.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

