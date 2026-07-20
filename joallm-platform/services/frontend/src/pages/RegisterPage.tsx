import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BrainCircuit, Search, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { RegisterForm } from '../components/common/FormValidation';
import { StandaloneLogo } from '../components/ui/Logo';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
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
      icon: BrainCircuit,
      title: 'Multi-model chat',
      description: 'Switch between providers without leaving the workspace'
    },
    {
      icon: Search,
      title: 'Grounded knowledge',
      description: 'Upload, index, and inspect source-backed answers'
    },
    {
      icon: Workflow,
      title: 'Operational workflows',
      description: 'Turn repeatable prompting into reusable AI flows'
    },
    {
      icon: ShieldCheck,
      title: 'Enterprise-aware controls',
      description: 'Plan visibility, permissions, and safer team adoption'
    }
  ];

  return (
    <div className="atrisi-page min-h-screen flex items-center justify-center p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Features */}
        <div className="hidden lg:block space-y-8">
          <div>
            <div className="mb-6">
              <StandaloneLogo />
            </div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800 shadow-sm">
              <Sparkles className="h-4 w-4 text-teal-600" />
              Connected AI workspace
            </div>
            <h1 className="text-4xl font-bold text-slate-950 mb-4">
              Bring chat, knowledge, workflows, and governance into one workspace
            </h1>
            <p className="text-xl text-slate-600 mb-8">
              Create your account and start with the same connected product experience the landing page promises.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="mb-3 inline-flex rounded-2xl bg-teal-50 p-3 text-teal-700">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-950 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_0_40px_rgba(20,184,166,0.12)]">
            <div className="flex items-center mb-3">
              <Sparkles className="w-6 h-6 mr-2 text-teal-300" />
              <h3 className="text-lg font-semibold">Free Forever Plan</h3>
            </div>
            <p className="text-slate-300">
              Start with the free workspace and upgrade only when you need higher limits, more automation, and broader team access.
            </p>
          </div>
        </div>

        {/* Right Side - Registration Form */}
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex justify-center mb-4">
              <StandaloneLogo />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Create your account
            </h2>
            <p className="text-gray-600">
              Start with a connected AI workspace built for real work
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
                <Link to="/terms" className="text-joa-primary hover:text-teal-800">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-joa-primary hover:text-teal-800">
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
                className="font-medium text-joa-primary hover:text-teal-800 transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>

          {/* Mobile Features */}
          <div className="lg:hidden mt-8 bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-teal-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              What you'll get:
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center text-gray-600">
                  <feature.icon className="mr-2 h-4 w-4 text-joa-primary" />
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
