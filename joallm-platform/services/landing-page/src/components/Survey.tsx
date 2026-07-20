import React, { useState } from 'react';
import { SurveyService } from '../services/surveyService';
import type { SurveyData } from '../services/surveyService';

const userTypeOptions = [
  {
    value: 'developer' as const,
    label: 'Developer',
    description: 'I build applications and need AI for coding, debugging, and automation',
    icon: '💻'
  },
  {
    value: 'business' as const,
    label: 'Business Professional',
    description: 'I use AI for business analysis, reporting, and decision making',
    icon: '📊'
  },
  {
    value: 'analyst' as const,
    label: 'Data Analyst',
    description: 'I work with data analysis, visualization, and insights generation',
    icon: '📈'
  },
  {
    value: 'casual' as const,
    label: 'Casual User',
    description: 'I use AI for personal projects, learning, and general assistance',
    icon: '🎯'
  }
];

const companySizeOptions = [
  { value: '1-10' as const, label: '1-10 employees' },
  { value: '11-50' as const, label: '11-50 employees' },
  { value: '51-200' as const, label: '51-200 employees' },
  { value: '201-1000' as const, label: '201-1,000 employees' },
  { value: '1000+' as const, label: '1,000+ employees' }
];

const currentToolsOptions = [
  'ChatGPT',
  'Claude',
  'Google Bard/Gemini',
  'GitHub Copilot',
  'Custom GPTs',
  'Other AI tools',
  'No AI tools currently'
];

const painPointsOptions = [
  'Cost of multiple AI subscriptions',
  'Inconsistent AI responses across tools',
  'Lack of integration between tools',
  'Privacy and data security concerns',
  'Limited customization options',
  'Poor user interface',
  'Slow response times',
  'Limited context understanding',
  'No workflow automation',
  'No document analysis capabilities'
];

const featureRequestsOptions = [
  'Multi-LLM support in one platform',
  'RAG (Retrieval-Augmented Generation)',
  'Visual workflow builder',
  'Interactive notebooks',
  'API access for developers',
  'Advanced analytics and monitoring',
  'Enterprise security features',
  'Custom model fine-tuning',
  'Team collaboration tools',
  'Mobile app',
  'Voice interface',
  'Real-time collaboration'
];

const budgetOptions = [
  { value: 'free' as const, label: 'Free tier only' },
  { value: 'under-100' as const, label: 'Under $100/month' },
  { value: '100-500' as const, label: '$100-500/month' },
  { value: '500-2000' as const, label: '$500-2,000/month' },
  { value: '2000+' as const, label: '$2,000+/month' }
];

const industryOptions = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Retail',
  'Manufacturing',
  'Consulting',
  'Marketing',
  'Research',
  'Government',
  'Other'
];

export const Survey: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [surveyData, setSurveyData] = useState<SurveyData>({
    userType: 'casual',
    currentTools: [],
    primaryUseCase: '',
    painPoints: [],
    featureRequests: [],
    budget: 'free',
    source: 'landing-page'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = 4;

  const handleUserTypeChange = (userType: 'developer' | 'business' | 'analyst' | 'casual') => {
    setSurveyData(prev => ({ ...prev, userType }));
  };

  const handleInputChange = (field: keyof SurveyData, value: string | string[] | undefined) => {
    setSurveyData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayToggle = (field: 'currentTools' | 'painPoints' | 'featureRequests', value: string) => {
    setSurveyData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return surveyData.userType !== 'casual'; // Must select a user type
      case 2:
        return surveyData.currentTools.length > 0 && surveyData.primaryUseCase.trim() !== '';
      case 3:
        return surveyData.painPoints.length > 0 && surveyData.featureRequests.length > 0;
      case 4:
        return true; // Contact info is optional
      default:
        return false;
    }
  };

  const submitSurvey = async () => {
    if (!isStepValid()) return;

    setIsSubmitting(true);
    setError('');

    try {
      await SurveyService.submitSurvey(surveyData);
      setIsSubmitted(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit survey');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-joa-dark mb-4">Thank You!</h2>
          <p className="text-lg text-joa-text mb-6">
            Your feedback is invaluable to us. We'll use this information to make JoaLLM the perfect tool for your needs.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-joa-text">
              <strong>Selected User Type:</strong> {userTypeOptions.find(opt => opt.value === surveyData.userType)?.label}
            </p>
            <p className="text-sm text-joa-text">
              <strong>Use Case:</strong> {surveyData.primaryUseCase}
            </p>
            <p className="text-sm text-joa-text">
              <strong>Pain Points:</strong> {surveyData.painPoints.length} selected
            </p>
            <p className="text-sm text-joa-text">
              <strong>Features Requested:</strong> {surveyData.featureRequests.length} selected
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="btn-primary mt-6"
            >
              Close Survey
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-joa-dark mb-2">Help Us Build Better AI</h2>
        <p className="text-joa-text">
          Tell us about your needs and we'll tailor JoaLLM to serve you better.
        </p>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-joa-text mb-2">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-joa-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Step 1: User Type Selection */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-joa-dark">What best describes you?</h3>
          <div className="grid grid-cols-1 gap-4">
            {userTypeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleUserTypeChange(option.value)}
                className={`p-6 text-left border-2 rounded-xl transition-all duration-200 ${
                  surveyData.userType === option.value
                    ? 'border-joa-primary bg-joa-primary/10'
                    : 'border-gray-200 hover:border-joa-primary/50'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="text-3xl">{option.icon}</div>
                  <div>
                    <h4 className="font-semibold text-joa-dark">{option.label}</h4>
                    <p className="text-sm text-joa-text mt-1">{option.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Current Tools & Use Case */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-joa-dark">Tell us about your current setup</h3>

          <div>
            <label className="block text-sm font-medium text-joa-dark mb-3">
              Which AI tools do you currently use? (Select all that apply)
            </label>
            <div className="grid grid-cols-1 gap-3">
              {currentToolsOptions.map((tool) => (
                <label key={tool} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={surveyData.currentTools.includes(tool)}
                    onChange={() => handleArrayToggle('currentTools', tool)}
                    className="w-4 h-4 text-joa-primary border-gray-300 rounded focus:ring-joa-primary"
                  />
                  <span className="text-joa-text">{tool}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-joa-dark mb-2">
              What's your primary use case for AI?
            </label>
            <textarea
              value={surveyData.primaryUseCase}
              onChange={(e) => handleInputChange('primaryUseCase', e.target.value)}
              placeholder="Describe how you primarily use AI tools..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-joa-dark mb-2">
              Company Size (Optional)
            </label>
            <select
              value={surveyData.companySize || ''}
              onChange={(e) => handleInputChange('companySize', e.target.value || undefined)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent"
            >
              <option value="">Select company size...</option>
              {companySizeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-joa-dark mb-2">
              Industry (Optional)
            </label>
            <select
              value={surveyData.industry || ''}
              onChange={(e) => handleInputChange('industry', e.target.value || undefined)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent"
            >
              <option value="">Select industry...</option>
              {industryOptions.map((industry) => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 3: Pain Points & Features */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-joa-dark">What are your biggest challenges and needs?</h3>

          <div>
            <label className="block text-sm font-medium text-joa-dark mb-3">
              What are your biggest pain points with current AI tools? (Select all that apply)
            </label>
            <div className="grid grid-cols-1 gap-3">
              {painPointsOptions.map((point) => (
                <label key={point} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={surveyData.painPoints.includes(point)}
                    onChange={() => handleArrayToggle('painPoints', point)}
                    className="w-4 h-4 mt-1 text-joa-primary border-gray-300 rounded focus:ring-joa-primary"
                  />
                  <span className="text-joa-text text-sm leading-relaxed">{point}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-joa-dark mb-3">
              Which features would you find most valuable in JoaLLM? (Select all that apply)
            </label>
            <div className="grid grid-cols-1 gap-3">
              {featureRequestsOptions.map((feature) => (
                <label key={feature} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={surveyData.featureRequests.includes(feature)}
                    onChange={() => handleArrayToggle('featureRequests', feature)}
                    className="w-4 h-4 mt-1 text-joa-primary border-gray-300 rounded focus:ring-joa-primary"
                  />
                  <span className="text-joa-text text-sm leading-relaxed">{feature}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-joa-dark mb-2">
              What's your budget for AI tools?
            </label>
            <div className="grid grid-cols-1 gap-3">
              {budgetOptions.map((option) => (
                <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="budget"
                    value={option.value}
                    checked={surveyData.budget === option.value}
                    onChange={(e) => handleInputChange('budget', e.target.value as 'free' | 'under-100' | '100-500' | '500-2000' | '2000+')}
                    className="w-4 h-4 text-joa-primary border-gray-300 focus:ring-joa-primary"
                  />
                  <span className="text-joa-text">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Contact & Comments */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-joa-dark">Contact Information (Optional)</h3>

          <div>
            <label className="block text-sm font-medium text-joa-dark mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={surveyData.contactEmail || ''}
              onChange={(e) => handleInputChange('contactEmail', e.target.value || undefined)}
              placeholder="your.email@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent"
            />
            <p className="text-xs text-joa-text mt-1">
              We'll only use this to follow up about JoaLLM features that interest you.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-joa-dark mb-2">
              Additional Comments
            </label>
            <textarea
              value={surveyData.additionalComments || ''}
              onChange={(e) => handleInputChange('additionalComments', e.target.value || undefined)}
              placeholder="Any other thoughts or requirements you'd like to share..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent resize-none"
              rows={4}
            />
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
            currentStep === 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-joa-dark hover:bg-gray-300'
          }`}
        >
          Previous
        </button>

        <div className="flex space-x-3">
          {currentStep < totalSteps ? (
            <button
              onClick={nextStep}
              disabled={!isStepValid()}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                isStepValid()
                  ? 'btn-primary'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Next
            </button>
          ) : (
            <button
              onClick={submitSurvey}
              disabled={isSubmitting || !isStepValid()}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                isSubmitting || !isStepValid()
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Survey'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
