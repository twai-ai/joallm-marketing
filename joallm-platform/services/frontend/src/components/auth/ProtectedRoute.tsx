import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireRole?: 'casual' | 'admin' | 'premium' | 'superuser';
  requireSubscription?: 'free' | 'pro' | 'enterprise';
  fallbackPath?: string;
}

const SLOW_AUTH_HINT_MS = 8_000;

function AuthLoadingScreen({ showSlowHint }: { showSlowHint: boolean }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-3">
        <LoadingSkeleton variant="rectangular" height={48} />
        <LoadingSkeleton width="80%" />
        <LoadingSkeleton width="60%" />
      </div>
      {showSlowHint && (
        <div className="text-center max-w-sm space-y-3">
          <p className="text-sm text-gray-600">
            Still connecting. This can take longer on a slow network.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-gray-900 underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export function ProtectedRoute({
  children,
  requireAuth = true,
  requireRole,
  requireSubscription,
  fallbackPath = '/login'
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowSlowHint(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSlowHint(true), SLOW_AUTH_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  // Show loading while checking authentication
  if (isLoading) {
    return <AuthLoadingScreen showSlowHint={showSlowHint} />;
  }

  // If authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // If user is authenticated but trying to access auth pages, redirect to home
  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Check role requirements
  if (requireRole && user && user.role !== requireRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check subscription requirements
  if (requireSubscription && user && user.subscriptionTier !== requireSubscription) {
    return <Navigate to="/upgrade" replace />;
  }

  return <>{children}</>;
}

// Convenience components for common use cases
export function AuthRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth={false}>
      {children}
    </ProtectedRoute>
  );
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth={true} requireRole="admin">
      {children}
    </ProtectedRoute>
  );
}

export function PremiumRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth={true} requireSubscription="pro">
      {children}
    </ProtectedRoute>
  );
}
