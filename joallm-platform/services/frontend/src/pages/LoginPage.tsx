import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 15% 10%, rgba(15,118,110,0.16), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 0%, rgba(15,23,42,0.1), transparent 45%), linear-gradient(165deg, #0f172a 0%, #1e293b 42%, #0f766e 140%)',
        }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-4 py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <div className="max-w-md text-white lg:flex-1">
          <StandaloneLogo />
          <p className="app-display mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-teal-200/90">
            ATRISI
          </p>
          <h1 className="app-display mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Marketing operations for the institution
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Sign in with your @atrisi.org account to work Acquisition, Studio, and publishing
            alongside the team.
          </p>
        </div>

        <div className="w-full max-w-md lg:flex-1">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-slate-950/30">
            <div className="border-b border-slate-100 px-8 py-6">
              <h2 className="app-display text-2xl font-semibold text-slate-950">Sign in</h2>
              <p className="mt-1 text-sm text-slate-500">Institution members only</p>
            </div>

            <div className="px-8 py-7">
              {errors.general && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-sm text-red-700">{errors.general}</p>
                </div>
              )}

              {preAuthToken ? (
                <form onSubmit={handleTwoFactorVerify} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Two-factor code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0f766e]/25 focus:ring-2"
                      placeholder="123456"
                      required
                    />
                    {twoFactorMessage && (
                      <p className="mt-2 text-xs text-slate-500">{twoFactorMessage}</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-atrisi-primary w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {isLoading ? 'Verifying…' : 'Verify and continue'}
                  </button>
                </form>
              ) : (
                <>
                  <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <GoogleLoginButton />
                </>
              )}

              <p className="mt-6 text-center text-sm text-slate-500">
                Need an account?{' '}
                <Link to="/register" className="font-medium text-[#0f766e] hover:underline">
                  Register
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
