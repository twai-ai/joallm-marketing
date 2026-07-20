import React from 'react';
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

export function ProtectedRoute({
  children,
  requireAuth = true,
  requireRole,
  requireSubscription,
  fallbackPath = '/login'
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication
  if (isLoading) {
    return <LoadingSkeleton />;
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
