import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CartProvider } from "@/components/retailer/CartContext";
import { WishlistProvider } from "@/components/retailer/WishlistContext";
import { ErrorBoundary } from "@/components/shared";

// Auth pages
import {
  LoginPage,
  RoleSelectionPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  ApplicationSubmittedPage,
  ApplicationPendingPage,
} from "./pages/auth";

// Apply pages
import { PublisherApplication, RetailerApplication } from "./pages/apply";

// Publisher pages
import {
  PublisherDashboard,
  PublisherOrdersList,
  PublisherOrderDetail,
  PublisherProfile,
  PublisherEditTitle,
  PublisherTransactionHistory,
  PublisherTransfers,
  PublisherWithdraw,
  PublisherMessages,
  PublisherAnalytics,
  PublisherOnboarding,
} from "./pages/publisher";
import { PublisherTitlesList } from "./pages/publisher/PublisherTitlesList";
import { PublisherSettings } from "./pages/publisher/PublisherSettings";
import { PublisherHelpCenter, RetailerHelpCenter } from "./pages/shared/HelpCenter";

// Retailer pages
import {
  RetailerCatalogue,
  RetailerTitleDetail,
  RetailerCart,
  RetailerCheckout,
  RetailerOrderConfirmation,
  RetailerOrdersList,
  RetailerOrderDetail,
  RetailerProfile,
  RetailerWishlist,
} from "./pages/retailer";
import { RetailerSettings } from "./pages/retailer/RetailerSettings";

// Admin pages
// Public pages
import { PublisherPublicProfile } from "./pages/public";

import {
  AdminDashboard,
  AdminApplications,
  AdminApplicationDetail,
  AdminPublishers,
  AdminPublisherDetail,
  AdminRetailers,
  AdminRetailerDetail,
  AdminOrders,
  AdminOrderDetail,
  AdminAnalytics,
  AdminFulfillmentQueue,
  PrintSlipsPage,
} from "./pages/admin";
import { AdminSettings } from "./pages/admin/AdminSettings";

// Marketing pages
import { HomePage, PublishersPage, RetailersPage, PricingPage, FAQPage, ExploreMagazinesPage } from "./pages/marketing";

// Other pages
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Home redirect component that redirects based on auth state
const HomeRedirect = () => {
  const { user, userRole, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // TODO: Check user.application_status === 'pending' and redirect to /pending
  // This requires the useAuth hook to expose application status
  // For now, users with no approved role are redirected to /pending
  
  // Redirect based on role
  switch (userRole) {
    case 'publisher':
      return <Navigate to="/publisher" replace />;
    case 'retailer':
      return <Navigate to="/retailer" replace />;
    case 'admin':
      return <Navigate to="/admin" replace />;
    default:
      // User exists but has no approved role - redirect to pending
      return <Navigate to="/pending" replace />;
  }
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Marketing pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/explore" element={<ExploreMagazinesPage />} />
      <Route path="/publishers" element={<PublishersPage />} />
      <Route path="/retailers" element={<RetailersPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/faq" element={<FAQPage />} />

      {/* Legacy home redirect for logged-in users */}
      <Route path="/home" element={<HomeRedirect />} />

      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/apply" element={<RoleSelectionPage />} />
      <Route path="/apply/publisher" element={<PublisherApplication />} />
      <Route path="/apply/retailer" element={<RetailerApplication />} />
      <Route path="/apply/submitted" element={<ApplicationSubmittedPage />} />
      <Route path="/pending" element={<ApplicationPendingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/p/:slug" element={<PublisherPublicProfile />} />

      {/* Publisher routes */}
      <Route
        path="/publisher"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/orders"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherOrdersList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/orders/:id"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherOrderDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/profile"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/titles"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherTitlesList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/titles/new"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherEditTitle />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/titles/:id/edit"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherEditTitle />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/transactions"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherTransactionHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/transfers"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherTransfers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/transfers/withdraw"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherWithdraw />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/messages"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherMessages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/settings"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/analytics"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherAnalytics />
          </ProtectedRoute>
        }
      />
      {/* Publisher onboarding - full screen, no layout */}
      <Route
        path="/publisher/onboarding"
        element={
          <ProtectedRoute allowedRoles={['publisher']}>
            <PublisherOnboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publisher/help"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherHelpCenter />
          </ProtectedRoute>
        }
      />

      {/* Retailer routes - wrapped in CartProvider and WishlistProvider */}
      <Route
        path="/retailer"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerCatalogue />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/retailer/catalogue/:id"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerTitleDetail />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/retailer/wishlist"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerWishlist />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/retailer/cart"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerCart />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/retailer/checkout"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerCheckout />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/retailer/order-confirmation/:id"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerOrderConfirmation />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/retailer/orders"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerOrdersList />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/retailer/orders/:id"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerOrderDetail />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/retailer/profile"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerProfile />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/retailer/settings"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerSettings />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/retailer/help"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <RetailerHelpCenter />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/applications"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminApplications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/applications/:id"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminApplicationDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/publishers"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminPublishers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/publishers/:id"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminPublisherDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/retailers"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminRetailers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/retailers/:id"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminRetailerDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminOrders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/orders/:id"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminOrderDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fulfillment"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminFulfillmentQueue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fulfillment/print"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <PrintSlipsPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ErrorBoundary>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
