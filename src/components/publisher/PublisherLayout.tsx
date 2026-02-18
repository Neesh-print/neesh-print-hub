import { useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { NavigationMenu, MobileBottomNav, SidebarNav, NotificationCenter, ChangePasswordModal } from "@/components/shared";
import { Logo } from "@/components/neesh/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface PublisherLayoutProps {
  children: ReactNode;
}

export const PublisherLayout = ({ children }: PublisherLayoutProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  useEffect(() => {
    if (!user) return;
    const checkPassword = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('has_set_password')
        .eq('user_id', user.id)
        .single();
      if (data && data.has_set_password === false) {
        setNeedsPasswordSetup(true);
      }
    };
    checkPassword();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <SidebarNav userRole="publisher" />

      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b border-border md:hidden">
        <div className="h-full px-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/publisher")}
            className="hover:opacity-80 transition-opacity"
          >
            <Logo size="md" />
          </button>
          
          <NotificationCenter userRole="publisher" />
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:pl-60">
        {/* Desktop top bar with notifications */}
        <div className="hidden md:flex items-center justify-end px-6 py-3 border-b border-border">
          <NotificationCenter userRole="publisher" />
        </div>
        <div className="md:pt-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav 
        userRole="publisher" 
        onMoreClick={() => setIsMenuOpen(true)} 
      />

      {/* Slide-out menu (kept for mobile hamburger fallback) */}
      <NavigationMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        userRole="publisher"
      />

      {/* Forced password setup for new users */}
      <ChangePasswordModal
        isOpen={needsPasswordSetup}
        onClose={() => setNeedsPasswordSetup(false)}
        forced
        onPasswordSet={() => setNeedsPasswordSetup(false)}
      />
    </div>
  );
};