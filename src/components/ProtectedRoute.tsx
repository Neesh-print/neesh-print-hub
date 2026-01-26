import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/shared';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('publisher' | 'retailer' | 'admin')[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, userRole, isLoading, isRoleLoading } = useAuth();
  const location = useLocation();

  if (isLoading || isRoleLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  if (!user) {
    // Redirect to login page, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // User doesn't have the required role, redirect to their appropriate dashboard
    const redirectPath = userRole === 'publisher' 
      ? '/publisher' 
      : userRole === 'retailer' 
        ? '/retailer' 
        : userRole === 'admin' 
          ? '/admin' 
          : '/login';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};
