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
      navigate('/');
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
    <div className="atrisi-page min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <StandaloneLogo />
          </div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800 shadow-sm">
            <Sparkles className="h-4 w-4 text-teal-600" />
            ATRISI Marketing
          </div>
          <h2 className="text-3xl font-bold text-slate-950 mb-2">Welcome back</h2>
          <p className="text-slate-600">
            Sign in to operate the Brain (Chat, Knowledge) and create in Studio (Media, Documents, Acquisition).
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="atrisi-accent-line w-full" aria-hidden />
          <div className="p-8">
            {errors.general && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            {preAuthToken ? (
              <form onSubmit={handleTwoFactorVerify} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Two-Factor Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    placeholder="Enter 6-digit code"
                  />
                  {twoFactorMessage && (
                    <p className="mt-2 text-sm text-slate-600">{twoFactorMessage}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isLoading || twoFactorCode.length !== 6}
                  className="btn-atrisi-primary w-full rounded-lg px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-700 hover:bg-slate-50"
                >
                  Back to Login
                </button>
              </form>
            ) : (
              <LoginForm onSubmit={handleLogin} loading={isLoading} />
            )}

            {!preAuthToken && (
              <>
                <div className="mb-6 mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-4 text-slate-500">Or continue with</span>
                    </div>
                  </div>
                </div>
                <GoogleLoginButton className="mb-3 w-full" />
                <button
                  type="button"
                  onClick={() => handleLogin({ email: 'demo@joallm.ai', password: 'demo123' })}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="mr-2 h-5 w-5 text-teal-700" />
                  Try Demo Account
                </button>
              </>
            )}
          </div>
        </div>

        <div className="text-center">
          <p className="text-slate-600">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-teal-700 transition-colors hover:text-teal-800"
            >
              Sign up for free
            </Link>
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <h3 className="mb-4 text-center text-lg font-semibold text-slate-950">
            What the platform includes:
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center text-slate-600">
              <Workflow className="mr-2 h-4 w-4 text-teal-700" />
              Studio workspaces
            </div>
            <div className="flex items-center text-slate-600">
              <Search className="mr-2 h-4 w-4 text-teal-700" />
              Knowledge & Timelines
            </div>
            <div className="flex items-center text-slate-600">
              <Sparkles className="mr-2 h-4 w-4 text-teal-700" />
              Acquisition Channels
            </div>
            <div className="flex items-center text-slate-600">
              <ShieldCheck className="mr-2 h-4 w-4 text-teal-700" />
              Platform Connectors
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
