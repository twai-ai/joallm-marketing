import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { showSuccess, showError } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { env } from '../config/env';
import { authService } from '../services/authService';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const oauthCode = searchParams.get('code');
        let token = searchParams.get('token');
        let refresh = searchParams.get('refresh');
        const error = searchParams.get('error');
        const errorMessage = searchParams.get('message');

        if (error || errorMessage) {
          setStatus('error');
          setMessage(errorMessage || 'Authentication failed');
          showError('Authentication failed', errorMessage);
          return;
        }

        // If we got a one-time code, exchange it for tokens
        if (oauthCode && !token) {
          const raw = (env.VITE_API_URL || env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
          const apiUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw || 'localhost:3001'}`;
          const resp = await fetch(`${apiUrl}/api/auth/exchange?code=${oauthCode}`);
          if (!resp.ok) {
            setStatus('error');
            setMessage('Failed to complete authentication');
            showError('Authentication failed', 'Could not exchange authorization code');
            return;
          }
          const data = await resp.json();
          token = data.token;
          refresh = data.refreshToken;
        }

        if (!token) {
          setStatus('error');
          setMessage('No authentication token received');
          showError('Authentication failed', 'No token received');
          return;
        }

        // Store tokens
        storage.setSecure(STORAGE_KEYS.AUTH_TOKEN, token);
        if (refresh) {
          storage.setSecure(STORAGE_KEYS.REFRESH_TOKEN, refresh);
        }

        try {
          const user = await authService.getProfile(true);
          const displayName = user.name?.trim() || user.email?.split('@')[0] || 'User';

          // Store user info
          storage.setSecure(STORAGE_KEYS.USER, user);

          setStatus('success');
          setMessage('Authentication successful! Redirecting...');
          showSuccess(`Welcome, ${displayName}! You have been successfully authenticated.`);

          // Force page reload to refresh AuthContext
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } catch (error) {
          console.error('Error loading profile after auth:', error);
          setStatus('error');
          setMessage('Could not load your profile after authentication');
          showError('Authentication failed', 'Could not load your profile from the backend');
        }

      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred');
        showError('Authentication failed', 'An unexpected error occurred');
      }
    };

    handleCallback();
  }, [searchParams, navigate, login]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authenticating...</h2>
          <p className="text-gray-600">Please wait while we complete your authentication.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Failed</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Successful!</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="animate-pulse text-sm text-gray-500">Redirecting to the application...</div>
      </div>
    </div>
  );
}
