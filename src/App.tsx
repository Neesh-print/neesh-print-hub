import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CartProvider } from "@/components/retailer/CartContext";
import { WishlistProvider } from "@/components/retailer/WishlistContext";
import { ErrorBoundary, ScrollToTop } from "@/components/shared";

// Auth pages
import {
  LoginPage,
  RoleSelectionPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
  AuthCallback,
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
  PublisherEditProfile,
  PublisherEditTitle,
  PublisherTransactionHistory,
  PublisherTransfers,
  PublisherWithdraw,
  PublisherMessages,
  PublisherAnalytics,
  PublisherOnboarding,
  PublisherPayoutSettings,
  ContinueOnboarding,
  PublisherBulkImport,
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
  RetailerOrderInvoice,
  RetailerProfile,
  RetailerEditProfile,
  RetailerWishlist,
  RetailerMessages,
} from "./pages/retailer";
import { RetailerSettings } from "./pages/retailer/RetailerSettings";
// Shipping addresses now integrated into profile edit page

// Admin pages
// Public pages
import { PublisherPublicProfile, RetailerPublicProfile } from "./pages/public";

import {
  AdminApplications,
  AdminApplicationDetail,
  AdminPublisherDetail,
  AdminRetailerDetail,
  AdminOrderDetail,
  AdminMessages,
  AdminAnalytics,
  AdminMagazines,
  AdminBulkImport,
  PrintSlipsPage,
} from "./pages/admin";
import { AdminNustand } from "./pages/admin/AdminNustand";
import { AdminIndexReview } from "./pages/admin/AdminIndexReview";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { AdminToday } from "./pages/admin/v2/AdminToday";
import { AdminOrdersV2 } from "./pages/admin/v2/AdminOrdersV2";
import { AdminNetwork } from "./pages/admin/v2/AdminNetwork";

const adminOnly = (page: JSX.Element) => <ProtectedRoute allowedRoles={['admin']}>{page}</ProtectedRoute>;

// Onboarding pages
import { OnboardingContinue, OnboardingStart } from "./pages/onboarding";

// Marketing pages

// Error pages
import NotFound from "./pages/NotFound";
import { ErrorPage, OfflinePage, UnauthorizedPage } from "./pages/errors";

// Application status pages
import { ApplicationRejected } from "./pages/ApplicationRejected";

const queryClient = new QueryClient();

// The marketing site moved to neesh.art at the domain split; this app serves
// app.neesh.art. Marketing paths hard-redirect to the public site so one
// canonical copy of each page exists.
const MARKETING_SITE = "https://neesh.art";

const ExternalRedirect = ({ to }: { to: string }) => {
  if (typeof window !== "undefined") {
    window.location.replace(to);
  }
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>
  );
};

// The root of the app: signed-in users go to their dashboard (or their
// application status screen); everyone else belongs on the marketing site.
const RootGate = () => {
  const { user, isLoading, isRoleLoading } = useAuth();
  if (isLoading || isRoleLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }
  if (!user) {
    return <ExternalRedirect to={MARKETING_SITE} />;
  }
  return <HomeRedirect />;
};

// Home redirect component that redirects based on auth state
const HomeRedirect = () => {
  const { user, userRole, publisherStatus, isLoading, isRoleLoading } = useAuth();
  
  // Wait for both auth and role to finish loading
  if (isLoading || isRoleLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check publisher application status
  if (userRole === 'publisher' && publisherStatus) {
    const { applicationStatus } = publisherStatus;

    if (applicationStatus === 'draft') {
      return <Navigate to="/apply/publisher" replace />;
    }
    if (applicationStatus === 'submitted') {
      return <Navigate to="/pending" replace />;
    }
    if (applicationStatus === 'rejected') {
      return <Navigate to="/rejected" replace />;
    }
    // Only approved publishers reach the dashboard
    if (applicationStatus === 'approved') {
      return <Navigate to="/publisher" replace />;
    }
  }

  // Redirect based on role (role fetch is complete at this point)
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
      {/* The marketing site lives at neesh.art; these paths forward there.
          Signed-in users hitting the root go to their dashboard instead. */}
      <Route path="/" element={<RootGate />} />
      <Route path="/explore" element={<ExternalRedirect to={`${MARKETING_SITE}/index`} />} />
      <Route path="/publishers" element={<ExternalRedirect to={`${MARKETING_SITE}/publishers`} />} />
      <Route path="/retailers" element={<ExternalRedirect to={`${MARKETING_SITE}/spaces`} />} />
      <Route path="/pricing" element={<ExternalRedirect to={`${MARKETING_SITE}/publishers`} />} />
      <Route path="/faq" element={<ExternalRedirect to={`${MARKETING_SITE}/faq`} />} />
      <Route path="/legal/privacy" element={<ExternalRedirect to={`${MARKETING_SITE}/privacy`} />} />
      <Route path="/legal/terms" element={<ExternalRedirect to={`${MARKETING_SITE}/terms`} />} />
      <Route path="/legal/publisher-agreement" element={<ExternalRedirect to={`${MARKETING_SITE}/publisher-agreement`} />} />
      <Route path="/legal/retailer-agreement" element={<ExternalRedirect to={`${MARKETING_SITE}/retailer-agreement`} />} />

      {/* Legacy home redirect for logged-in users */}
      <Route path="/home" element={<HomeRedirect />} />

      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/apply" element={<RoleSelectionPage />} />
      <Route path="/apply/publisher" element={<PublisherApplication />} />
      <Route path="/apply/retailer" element={<RetailerApplication />} />
      <Route path="/apply/submitted" element={<ApplicationSubmittedPage />} />
      <Route path="/pending" element={<ApplicationPendingPage />} />
      <Route path="/rejected" element={<ApplicationRejected />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/p/:slug" element={<PublisherPublicProfile />} />
      <Route path="/r/:slug" element={<RetailerPublicProfile />} />

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
        path="/publisher/profile/edit"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherEditProfile />
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
        path="/publisher/titles/import"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherBulkImport />
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
        path="/publisher/settings/payout"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <PublisherPayoutSettings />
          </ProtectedRoute>
        }
      />
      {/* Target of the payout-nudge emails and of Stripe's refresh_url.
          Mints a fresh Stripe account link on every visit. */}
      <Route
        path="/onboarding/continue"
        element={
          <ProtectedRoute allowedRoles={['publisher', 'admin']}>
            <ContinueOnboarding />
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
      {/* Stripe payout onboarding - full screen pre-flight before the redirect */}
      <Route
        path="/onboarding/start"
        element={
          <ProtectedRoute allowedRoles={['publisher']}>
            <OnboardingStart />
          </ProtectedRoute>
        }
      />
      {/* Stripe payout onboarding - full screen redirect, self-heals expired links */}
      <Route
        path="/onboarding/continue"
        element={
          <ProtectedRoute allowedRoles={['publisher']}>
            <OnboardingContinue />
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
        path="/retailer/orders/:id/invoice"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerOrderInvoice />
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
        path="/retailer/profile/edit"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerEditProfile />
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
        path="/retailer/messages"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <WishlistProvider>
              <CartProvider>
                <RetailerMessages />
              </CartProvider>
            </WishlistProvider>
          </ProtectedRoute>
        }
      />
      {/* Shipping addresses now integrated into /retailer/profile/edit */}
      <Route
        path="/retailer/help"
        element={
          <ProtectedRoute allowedRoles={['retailer', 'admin']}>
            <RetailerHelpCenter />
          </ProtectedRoute>
        }
      />

      {/* Admin routes. Today, Orders and Network are the redesigned admin;
          Dashboard, Fulfillment, Transfers, Payouts and the Publishers and
          Retailers lists were folded into them and now redirect. */}
      <Route path="/admin" element={adminOnly(<AdminToday />)} />
      <Route path="/admin/orders" element={adminOnly(<AdminOrdersV2 />)} />
      <Route path="/admin/orders/:id" element={adminOnly(<AdminOrderDetail />)} />
      <Route path="/admin/fulfillment" element={<Navigate to="/admin/orders?view=to_ship" replace />} />
      <Route path="/admin/fulfillment/print" element={adminOnly(<PrintSlipsPage />)} />
      <Route path="/admin/transfers" element={<Navigate to="/admin/orders?view=payout_ready" replace />} />
      <Route path="/admin/network" element={adminOnly(<AdminNetwork />)} />
      <Route path="/admin/publishers" element={<Navigate to="/admin/network" replace />} />
      <Route path="/admin/publishers/:id" element={adminOnly(<AdminPublisherDetail />)} />
      <Route path="/admin/retailers" element={<Navigate to="/admin/network?type=spaces" replace />} />
      <Route path="/admin/retailers/:id" element={adminOnly(<AdminRetailerDetail />)} />
      <Route path="/admin/payouts" element={<Navigate to="/admin/network?setup=payouts" replace />} />
      <Route path="/admin/applications" element={adminOnly(<AdminApplications />)} />
      <Route path="/admin/applications/:id" element={adminOnly(<AdminApplicationDetail />)} />
      <Route path="/admin/nustand" element={adminOnly(<AdminNustand />)} />
      <Route path="/admin/magazines" element={adminOnly(<AdminMagazines />)} />
      <Route path="/admin/magazines/import" element={adminOnly(<AdminBulkImport />)} />
      <Route path="/admin/index-review" element={adminOnly(<AdminIndexReview />)} />
      <Route path="/admin/analytics" element={adminOnly(<AdminAnalytics />)} />
      <Route path="/admin/messages" element={adminOnly(<AdminMessages />)} />
      <Route path="/admin/settings" element={adminOnly(<AdminSettings />)} />
      {/* Preview links from before the redesign replaced the classic admin */}
      <Route path="/admin/v2" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/v2/orders" element={<Navigate to="/admin/orders" replace />} />

      {/* Error pages */}
      <Route path="/error" element={<ErrorPage />} />
      <Route path="/offline" element={<OfflinePage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* 404 catch-all - must be last */}
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
            <ScrollToTop />
            <AppRoutes />
          </BrowserRouter>
        </ErrorBoundary>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
