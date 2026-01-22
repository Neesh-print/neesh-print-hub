import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/shared';
import { APPLICATION_STATUS } from '@/lib/constants';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('publisher' | 'retailer' | 'admin')[];
  /**
   * If true, allows draft/submitted publishers to access this route.
   * Used for routes like the application form resume flow.
   */
  allowPendingPublishers?: boolean;
}

export const ProtectedRoute = ({
  children,
  allowedRoles,
  allowPendingPublishers = false,
}: ProtectedRouteProps) => {
  const { user, userRole, publisherStatus, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  if (!user) {
    // Redirect to login page, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if the user has the required role
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

  // Special handling for publishers - check application status
  if (userRole === 'publisher' && !allowPendingPublishers) {
    // If trying to access publisher routes, check application status
    if (allowedRoles?.includes('publisher') || location.pathname.startsWith('/publisher')) {
      if (publisherStatus) {
        const { applicationStatus } = publisherStatus;

        // Draft publishers should resume their application
        if (applicationStatus === APPLICATION_STATUS.DRAFT) {
          // Allow access to the application page
          if (location.pathname === '/apply/publisher') {
            return <>{children}</>;
          }
          // Redirect to application page to continue
          return <Navigate to="/apply/publisher" replace />;
        }

        // Submitted publishers should see pending page
        if (applicationStatus === APPLICATION_STATUS.SUBMITTED) {
          // Allow access to the pending page
          if (location.pathname === '/pending') {
            return <>{children}</>;
          }
          // Redirect to pending page
          return <Navigate to="/pending" replace />;
        }

        // Rejected publishers should see rejection page
        if (applicationStatus === APPLICATION_STATUS.REJECTED) {
          // Allow access to the rejected page
          if (location.pathname === '/rejected') {
            return <>{children}</>;
          }
          // Redirect to rejected page
          return <Navigate to="/rejected" replace />;
        }

        // Only approved publishers can access publisher dashboard routes
        if (applicationStatus !== APPLICATION_STATUS.APPROVED) {
          return <Navigate to="/pending" replace />;
        }
      } else {
        // No publisher record found - redirect to application
        if (location.pathname !== '/apply/publisher') {
          return <Navigate to="/apply/publisher" replace />;
        }
      }
    }
  }

  return <>{children}</>;
};
