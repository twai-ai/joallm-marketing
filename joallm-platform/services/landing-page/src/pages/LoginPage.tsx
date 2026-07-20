import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from '../components/common/FormValidation';
import { StandaloneLogo } from '../components/ui/Logo';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleLogin = async (data: { email: string; password: string }) => {
    try {
      setErrors({});
      await login(data.email, data.password);
      navigate('/'); // Redirect to home page after successful login
    } catch (error: any) {
      setErrors({ general: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <StandaloneLogo className="h-12 w-auto" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back
          </h2>
          <p className="text-gray-600">
            Sign in to your JoaLLM account to continue
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{errors.general}</p>
            </div>
          )}

          <LoginForm onSubmit={handleLogin} loading={isLoading} />

          {/* Divider */}
          <div className="mt-6 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
          </div>

          {/* Demo Account Button */}
          <button
            type="button"
            onClick={() => handleLogin({ email: 'demo@joallm.ai', password: 'demo123' })}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="w-5 h-5 mr-2 text-purple-500" />
            Try Demo Account
          </button>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
            >
              Sign up for free
            </Link>
          </p>
        </div>

        {/* Features Preview */}
        <div className="mt-8 bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            What you'll get access to:
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center text-gray-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              AI Chat & Conversations
            </div>
            <div className="flex items-center text-gray-600">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
              Document RAG Search
            </div>
            <div className="flex items-center text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Workflow Builder
            </div>
            <div className="flex items-center text-gray-600">
              <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
              Interactive Notebooks
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
