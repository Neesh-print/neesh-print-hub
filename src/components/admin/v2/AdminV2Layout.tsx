import { ReactNode, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, Clock, LogOut, MessageSquare, Package, Settings, Users } from "lucide-react";
import { Logo } from "@/components/neesh/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useAdminOverview } from "@/hooks/useAdminOverview";
import { needsYouCount, summarizeToday } from "@/lib/adminOverview";
import { cn } from "@/lib/utils";

interface Section {
  label: string;
  to: string;
  icon: ReactNode;
  /** Paths (prefixes) that belong to this section, for the active state. */
  match: (path: string) => boolean;
  /** Tabs shown above the section's list pages. */
  tabs?: { label: string; to: string }[];
}

const startsWithAny = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

const SECTIONS: Section[] = [
  { label: "Today", to: "/admin", icon: <Clock className="h-[18px] w-[18px]" />, match: (p) => p === "/admin" },
  {
    label: "Orders",
    to: "/admin/orders",
    icon: <Package className="h-[18px] w-[18px]" />,
    match: (p) => startsWithAny(p, ["/admin/orders", "/admin/fulfillment"]),
  },
  {
    label: "Network",
    to: "/admin/network",
    icon: <Users className="h-[18px] w-[18px]" />,
    match: (p) => startsWithAny(p, ["/admin/network", "/admin/publishers", "/admin/retailers", "/admin/applications", "/admin/nustand"]),
    tabs: [
      { label: "Directory", to: "/admin/network" },
      { label: "Applications", to: "/admin/applications" },
      { label: "Prospects", to: "/admin/nustand" },
    ],
  },
  {
    label: "Catalog",
    to: "/admin/magazines",
    icon: <BookOpen className="h-[18px] w-[18px]" />,
    match: (p) => startsWithAny(p, ["/admin/magazines", "/admin/index-review"]),
    tabs: [
      { label: "Titles", to: "/admin/magazines" },
      { label: "Index review", to: "/admin/index-review" },
      { label: "Import", to: "/admin/magazines/import" },
    ],
  },
  { label: "Insights", to: "/admin/analytics", icon: <BarChart3 className="h-[18px] w-[18px]" />, match: (p) => p.startsWith("/admin/analytics") },
  { label: "Inbox", to: "/admin/messages", icon: <MessageSquare className="h-[18px] w-[18px]" />, match: (p) => p.startsWith("/admin/messages") },
];

const itemClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground",
    active && "bg-secondary text-foreground",
  );

export interface AdminV2LayoutProps {
  children: ReactNode;
  /**
   * "classic" keeps the spacing pages built for the old layout expect (they
   * add their own padding); "v2" pages get the new padded column.
   */
  variant?: "v2" | "classic";
}

export const AdminV2Layout = ({ children, variant = "v2" }: AdminV2LayoutProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { data } = useAdminOverview();

  const badge = useMemo(() => {
    if (!data) return null;
    return needsYouCount(summarizeToday(data.orders, new Date()), data.review.applicationsWaiting);
  }, [data]);

  const section = SECTIONS.find((s) => s.match(pathname));
  // Tabs only on the section's list pages, not on a publisher's or order's own page.
  const tabs = section?.tabs?.some((t) => t.to === pathname) ? section.tabs : undefined;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const badgeFor = (s: Section) =>
    s.to === "/admin" && badge ? (
      <span className="rounded bg-foreground px-1.5 py-0.5 text-[11px] font-bold text-background">{badge}</span>
    ) : null;

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border px-4 py-6 md:sticky md:top-0 md:flex md:h-screen">
        <Link to="/admin" className="px-3" aria-label="Neesh admin home">
          <Logo size="md" />
        </Link>
        <nav aria-label="Admin" className="flex flex-col gap-0.5">
          {SECTIONS.map((s) => (
            <Link key={s.to} to={s.to} className={itemClass(s === section)} aria-current={s === section ? "page" : undefined}>
              {s.icon}
              <span className="flex-1">{s.label}</span>
              {badgeFor(s)}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5">
          <Link to="/admin/settings" className={itemClass(pathname.startsWith("/admin/settings"))}>
            <Settings className="h-[18px] w-[18px]" />
            Settings
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
          <Link to="/admin" aria-label="Neesh admin home">
            <Logo size="sm" />
          </Link>
          <div className="flex gap-2">
            <Link to="/admin/settings" aria-label="Settings" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border">
              <Settings className="h-[18px] w-[18px]" />
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-destructive"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {SECTIONS.map((s) => (
            <Link key={s.to} to={s.to} className={cn(itemClass(s === section), "shrink-0 py-2")}>
              {s.label}
              {badgeFor(s)}
            </Link>
          ))}
        </nav>

        <div className={cn("mx-auto w-full", variant === "v2" ? "max-w-6xl px-4 pb-16 pt-6 md:px-8 md:pt-8" : "max-w-7xl pb-16 md:pt-6")}>
          {tabs && (
            <div role="tablist" aria-label={section?.label} className={cn("mb-5 flex flex-wrap gap-2", variant === "classic" && "px-4 pt-4 md:px-6 md:pt-0")}>
              {tabs.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  role="tab"
                  aria-selected={t.to === pathname}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold",
                    t.to === pathname ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary",
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          )}
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
};
