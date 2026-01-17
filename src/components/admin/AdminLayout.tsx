import { useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  Users, 
  Store, 
  BarChart3, 
  Settings, 
  LogOut 
} from "lucide-react";
import { NavigationMenu, MobileBottomNav, SidebarNav } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  const moreMenuItems = [
    { label: "Applications", icon: <FileText className="w-5 h-5" />, path: "/admin/applications" },
    { label: "Publishers", icon: <Users className="w-5 h-5" />, path: "/admin/publishers" },
    { label: "Retailers", icon: <Store className="w-5 h-5" />, path: "/admin/retailers" },
    { label: "Analytics", icon: <BarChart3 className="w-5 h-5" />, path: "/admin/analytics" },
    { label: "Settings", icon: <Settings className="w-5 h-5" />, path: "/admin/settings" },
  ];

  const handleMoreNavigate = (path: string) => {
    navigate(path);
    setIsMoreSheetOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
    setIsMoreSheetOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <SidebarNav userRole="admin" />

      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b border-border md:hidden">
        <div className="h-full px-4 flex items-center justify-center">
          <button
            onClick={() => navigate("/admin")}
            className="font-display font-bold text-lg tracking-tight text-foreground"
          >
            NEESH
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14 pb-20 md:pt-0 md:pb-8 md:pl-60">
        <div className="max-w-7xl mx-auto md:pt-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav 
        userRole="admin" 
        onMoreClick={() => setIsMoreSheetOpen(true)} 
      />

      {/* More menu sheet (mobile only) */}
      <Sheet open={isMoreSheetOpen} onOpenChange={setIsMoreSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[70vh]">
          <SheetHeader className="mb-4">
            <SheetTitle>More Options</SheetTitle>
          </SheetHeader>
          
          <nav className="space-y-1">
            {moreMenuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleMoreNavigate(item.path)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-secondary transition-colors text-left"
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Slide-out menu (kept for fallback) */}
      <NavigationMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        userRole="admin"
      />
    </div>
  );
};