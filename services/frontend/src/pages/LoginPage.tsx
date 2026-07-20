import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, Workflow, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from '../components/common/FormValidation';
import { StandaloneLogo } from '../components/ui/Logo';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, completeTwoFactorLogin, isLoading } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMessage, setTwoFactorMessage] = useState('');

  const handleLogin = async (data: { email: string; password: string }) => {
    try {
      setErrors({});
      await login(data.email, data.password);
      navigate('/'); // Redirect to home page after successful login
    } catch (error: any) {
      if (error?.requiresTwoFactor && error?.preAuthToken) {
        setPreAuthToken(error.preAuthToken);
        setTwoFactorMessage(error.message || 'Enter your 2FA code to continue');
        return;
      }
      setErrors({ general: error.message });
    }
  };

  const handleTwoFactorVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preAuthToken) return;

    try {
      setErrors({});
      await completeTwoFactorLogin(twoFactorCode, preAuthToken);
      navigate('/');
    } catch (error: any) {
      setErrors({ general: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-joa-bg bg-joa-network flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <StandaloneLogo />
          </div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-200 bg-white/80 px-4 py-2 text-sm font-medium text-joa-primary shadow-sm">
            <Sparkles className="h-4 w-4" />
            Connected AI workspace
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back
          </h2>
          <p className="text-gray-600">
            Sign in to continue with chat, knowledge, workflows, and model routing in one place.
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{errors.general}</p>
            </div>
          )}

          {preAuthToken ? (
            <form onSubmit={handleTwoFactorVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Two-Factor Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Enter 6-digit code"
                />
                {twoFactorMessage && (
                  <p className="mt-2 text-sm text-gray-600">{twoFactorMessage}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={isLoading || twoFactorCode.length !== 6}
                className="w-full rounded-lg bg-joa-primary px-4 py-3 text-white hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verify and Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreAuthToken(null);
                  setTwoFactorCode('');
                  setTwoFactorMessage('');
                  setErrors({});
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-700 hover:bg-gray-50"
              >
                Back to Login
              </button>
            </form>
          ) : (
            <LoginForm onSubmit={handleLogin} loading={isLoading} />
          )}

          {!preAuthToken && (
            <>
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
              <GoogleLoginButton className="w-full mb-3" />
              <button
                type="button"
                onClick={() => handleLogin({ email: 'demo@joallm.ai', password: 'demo123' })}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="w-5 h-5 mr-2 text-joa-primary" />
                Try Demo Account
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-joa-primary hover:text-red-800 transition-colors"
            >
              Sign up for free
            </Link>
          </p>
        </div>

        {/* Features Preview */}
        <div className="mt-8 bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-red-100 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            What the platform includes:
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center text-gray-600">
              <Workflow className="mr-2 h-4 w-4 text-joa-primary" />
              Workflow automation
            </div>
            <div className="flex items-center text-gray-600">
              <Search className="mr-2 h-4 w-4 text-joa-primary" />
              Grounded retrieval
            </div>
            <div className="flex items-center text-gray-600">
              <Sparkles className="mr-2 h-4 w-4 text-joa-primary" />
              Multi-model chat
            </div>
            <div className="flex items-center text-gray-600">
              <ShieldCheck className="mr-2 h-4 w-4 text-joa-primary" />
              Enterprise-aware access
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
