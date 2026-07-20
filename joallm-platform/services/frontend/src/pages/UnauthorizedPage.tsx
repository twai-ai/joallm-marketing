import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Home, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const openUpgrade = () => {
    window.dispatchEvent(new CustomEvent('openUpgrade'));
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>

          {/* Message */}
          <p className="text-gray-600 mb-6">
            This page is available on JoaLLM Pro. Upgrade your plan to unlock the full feature set.
          </p>

          {/* User Info */}
          {user && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center mb-2">
                <Lock className="w-4 h-4 text-gray-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">Current Role</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 capitalize">
                {user.role}
              </div>
              <div className="text-sm text-gray-500">
                {user.subscriptionTier} subscription
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={openUpgrade}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </button>

            <button
              onClick={() => navigate(-1)}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-6 text-sm text-gray-500">
            Need access? Open the billing section and{' '}
            <button
              onClick={openUpgrade}
              className="text-blue-600 hover:text-blue-500 underline"
            >
              upgrade your plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
