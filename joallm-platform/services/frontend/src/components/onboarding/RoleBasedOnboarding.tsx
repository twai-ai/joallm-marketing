import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Sparkles, Zap, Database, Workflow, MessageSquare } from 'lucide-react';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { useAuth } from '../../contexts/AuthContext';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    route: string;
    description: string;
  };
  completed?: boolean;
}

interface RoleBasedOnboardingProps {
  onComplete?: () => void;
}

export function RoleBasedOnboarding({ onComplete }: RoleBasedOnboardingProps) {
  const { workspaceMode, getRoleConfig, getOnboardingSteps, completeOnboarding, isFirstTime } = useUserRole();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const roleConfig = getRoleConfig();
  const steps = getOnboardingSteps();

  // Generate role-specific onboarding steps
  const generateOnboardingSteps = (): OnboardingStep[] => {
    const baseSteps: OnboardingStep[] = [
      {
        id: 'welcome',
        title: `Welcome to ${roleConfig.name}`,
        description: `${roleConfig.name} highlights ${roleConfig.features.length} capabilities and defaults that fit this style of work.`,
        icon: <Sparkles className="w-8 h-8 text-blue-600" />,
      }
    ];

    switch (workspaceMode) {
      case 'enterprise':
        return [
          ...baseSteps,
          {
            id: 'workflow',
            title: 'Review Workflow Operations',
            description: 'Use governed workflows for repeatable AI processes and operational visibility.',
            icon: <Workflow className="w-8 h-8 text-blue-600" />,
            action: {
              label: 'Open Workflows',
              route: '/workflow',
              description: 'Review or build operational workflows'
            }
          },
          {
            id: 'security',
            title: 'Review Access & Security',
            description: 'Check your workspace settings, plan, and security posture before scaling usage.',
            icon: <Zap className="w-8 h-8 text-yellow-600" />,
            action: {
              label: 'Open Settings',
              route: '/settings',
              description: 'Review account, access, and security settings'
            }
          },
          {
            id: 'knowledge',
            title: 'Validate Knowledge Readiness',
            description: 'Upload documents and confirm they are ready before asking grounded questions.',
            icon: <Database className="w-8 h-8 text-green-600" />,
            action: {
              label: 'Open Knowledge',
              route: '/rag-search',
              description: 'Check knowledge ingestion and document readiness'
            }
          }
        ];

      case 'team':
        return [
          ...baseSteps,
          {
            id: 'knowledge',
            title: 'Set up Shared Knowledge',
            description: 'Upload documents and make them usable across conversations and repeatable work.',
            icon: <Database className="w-8 h-8 text-green-600" />,
            action: {
              label: 'Open Knowledge',
              route: '/rag-search',
              description: 'Upload and organize team knowledge'
            }
          },
          {
            id: 'workflow',
            title: 'Operationalize Repeated Work',
            description: 'Move successful prompting into workflows when the pattern becomes repeatable.',
            icon: <Zap className="w-8 h-8 text-purple-600" />,
            action: {
              label: 'Open Workflows',
              route: '/workflow',
              description: 'Turn repeated tasks into guided workflows'
            }
          },
          {
            id: 'chat',
            title: 'Ask a Grounded Question',
            description: 'Use the knowledge you just uploaded to get a source-backed answer quickly.',
            icon: <Sparkles className="w-8 h-8 text-blue-600" />,
            action: {
              label: 'Open Chat',
              route: '/chat',
              description: 'Continue into chat with grounded context'
            }
          }
        ];

      case 'personal':
        return [
          ...baseSteps,
          {
            id: 'chat',
            title: 'Start Your First Chat',
            description: 'Begin chatting with AI models for everyday tasks.',
            icon: <MessageSquare className="w-8 h-8 text-blue-600" />,
            action: {
              label: 'Start Chatting',
              route: '/chat',
              description: 'Begin your AI conversation'
            }
          },
          {
            id: 'templates',
            title: 'Try Quick Actions',
            description: 'Use pre-built templates for common tasks.',
            icon: <Zap className="w-8 h-8 text-yellow-600" />,
            action: {
              label: 'Explore Templates',
              route: '/chat',
              description: 'Try quick action templates'
            }
          },
          {
            id: 'discover',
            title: 'Discover Features',
            description: 'Explore the full range of AI capabilities available to you.',
            icon: <Sparkles className="w-8 h-8 text-purple-600" />,
            action: {
              label: 'Explore Features',
              route: '/',
              description: 'Discover what you can do'
            }
          }
        ];

      default:
        return baseSteps;
    }
  };

  const onboardingSteps = generateOnboardingSteps();

  const handleStepComplete = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  };

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
      onComplete?.();
    }
  };

  const handleAction = (action: OnboardingStep['action']) => {
    if (action) {
      handleStepComplete(onboardingSteps[currentStep].id);
      navigate(action.route);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    onComplete?.();
  };

  if (!isFirstTime) {
    return null;
  }

  const currentStepData = onboardingSteps[currentStep];
  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Welcome to JoaLLM</h2>
              <p className="text-blue-100">Let&apos;s get you started with {roleConfig.name}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-100">Step {currentStep + 1} of {onboardingSteps.length}</div>
              <div className="text-2xl font-bold">{Math.round(progress)}%</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 w-full bg-blue-500 rounded-full h-2">
            <div 
              className="bg-white rounded-full h-2 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              {currentStepData.icon}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {currentStepData.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {currentStepData.description}
            </p>
          </div>

          {/* Action Button */}
          {currentStepData.action && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
              <div className="text-center">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {currentStepData.action.label}
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {currentStepData.action.description}
                </p>
                <button
                  onClick={() => handleAction(currentStepData.action)}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {currentStepData.action.label}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Step Indicators */}
          <div className="flex justify-center space-x-2 mb-6">
            {onboardingSteps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${
                  index === currentStep
                    ? 'bg-blue-600'
                    : index < currentStep
                    ? 'bg-green-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Skip Onboarding
            </button>
            
            <div className="flex space-x-3">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>
              )}
              
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {currentStep === onboardingSteps.length - 1 ? 'Complete' : 'Next'}
                <ArrowRight className="w-4 h-4 ml-2 inline" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
