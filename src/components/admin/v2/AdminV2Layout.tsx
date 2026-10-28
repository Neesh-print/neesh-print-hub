import { ReactNode, useMemo } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, Clock, LogOut, MessageSquare, Package, Settings, Users } from "lucide-react";
import { Logo } from "@/components/neesh/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useAdminOverview } from "@/hooks/useAdminOverview";
import { needsYouCount, summarizeToday } from "@/lib/adminOverview";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  end?: boolean;
}

// Network, Catalog and Insights point at the classic pages until they're rebuilt.
const NAV: NavItem[] = [
  { label: "Today", to: "/admin/v2", icon: <Clock className="h-[18px] w-[18px]" />, end: true },
  { label: "Orders", to: "/admin/v2/orders", icon: <Package className="h-[18px] w-[18px]" /> },
  { label: "Network", to: "/admin/publishers", icon: <Users className="h-[18px] w-[18px]" /> },
  { label: "Catalog", to: "/admin/magazines", icon: <BookOpen className="h-[18px] w-[18px]" /> },
  { label: "Insights", to: "/admin/analytics", icon: <BarChart3 className="h-[18px] w-[18px]" /> },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground",
    isActive && "bg-secondary text-foreground",
  );

export const AdminV2Layout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data } = useAdminOverview();

  const badge = useMemo(() => {
    if (!data) return null;
    return needsYouCount(summarizeToday(data.orders, new Date()), data.review.applicationsWaiting);
  }, [data]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border px-4 py-6 md:flex md:sticky md:top-0 md:h-screen">
        <Link to="/admin/v2" className="px-3" aria-label="Neesh admin home">
          <Logo size="md" />
        </Link>
        <nav aria-label="Admin" className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.to === "/admin/v2" && badge ? (
                <span className="rounded bg-foreground px-1.5 py-0.5 text-[11px] font-bold text-background">{badge}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5">
          <NavLink to="/admin/settings" className={navClass}>
            <Settings className="h-[18px] w-[18px]" />
            Settings
          </NavLink>
          <Link to="/admin" className="rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">
            Classic admin
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 md:hidden">
          <Link to="/admin/v2" aria-label="Neesh admin home">
            <Logo size="sm" />
          </Link>
          <Link
            to="/admin/messages"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold"
          >
            <MessageSquare className="h-[18px] w-[18px]" />
            Inbox
          </Link>
        </header>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={(s) => cn(navClass(s), "shrink-0 py-2")}>
              {item.label}
              {item.to === "/admin/v2" && badge ? (
                <span className="rounded bg-foreground px-1.5 py-0.5 text-[11px] font-bold text-background">{badge}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8 md:pt-8">{children}</main>
      </div>
    </div>
  );
};
