import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { RegisterForm } from '../components/common/FormValidation';
import { StandaloneLogo } from '../components/ui/Logo';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleRegister = async (data: { email: string; password: string; name: string }) => {
    try {
      setErrors({});
      await register(data.email, data.password, data.name);
      navigate('/'); // Redirect to home page after successful registration
    } catch (error: any) {
      setErrors({ general: error.message });
    }
  };

  const features = [
    {
      icon: '💬',
      title: 'AI Conversations',
      description: 'Chat with multiple AI models'
    },
    {
      icon: '📚',
      title: 'Knowledge Base',
      description: 'Upload and search documents'
    },
    {
      icon: '⚡',
      title: 'Workflows',
      description: 'Automate AI tasks visually'
    },
    {
      icon: '📊',
      title: 'Analytics',
      description: 'Track your AI usage'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Features */}
        <div className="hidden lg:block space-y-8">
          <div>
            <div className="flex items-center mb-6">
              <StandaloneLogo className="h-10 w-auto mr-3" />
              <span className="text-2xl font-bold text-gray-900">JoaLLM</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Join the future of AI productivity
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Create your account and start building amazing AI-powered workflows today.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-gray-100">
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center mb-3">
              <Sparkles className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-semibold">Free Forever Plan</h3>
            </div>
            <p className="text-blue-100">
              Start with our free plan and upgrade anytime. No credit card required.
            </p>
          </div>
        </div>

        {/* Right Side - Registration Form */}
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex justify-center mb-4">
              <StandaloneLogo className="h-12 w-auto" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Create your account
            </h2>
            <p className="text-gray-600">
              Join thousands of users building with AI
            </p>
          </div>

          {/* Registration Form */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {errors.general && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{errors.general}</p>
              </div>
            )}

            <RegisterForm onSubmit={handleRegister} loading={isLoading} />

            {/* Terms and Privacy */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                By creating an account, you agree to our{' '}
                <Link to="/terms" className="text-blue-600 hover:text-blue-500">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-blue-600 hover:text-blue-500">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>

          {/* Mobile Features */}
          <div className="lg:hidden mt-8 bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              What you'll get:
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center text-gray-600">
                  <span className="text-lg mr-2">{feature.icon}</span>
                  <div>
                    <div className="font-medium">{feature.title}</div>
                    <div className="text-xs text-gray-500">{feature.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
