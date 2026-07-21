import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, AlertCircle } from "lucide-react";
import { AdminLayout, StatCard } from "@/components/admin";
import { BackNavigation, DataTable, StatusBadge, ButtonSecondary, FormInput, EmptyState, ButtonPrimary } from "@/components/neesh";
import type { StatusType } from "@/components/neesh/StatusBadge";
import { LoadingScreen } from "@/components/shared";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { humanizeRequirements } from "@/lib/stripeRequirements";
import type { StripeRequirementsDue } from "@/hooks/usePublisherProfile";

type PayoutState = "enabled" | "under_review" | "incomplete" | "not_started";

interface PayoutRow {
  id: string;
  name: string;
  email: string;
  state: PayoutState;
  outstanding: string;
  accountCreated: string;
  connected: boolean;
  // Satisfies DataTable's <T extends Record<string, unknown>> constraint.
  [key: string]: unknown;
}

// Map each payout state to a badge colour and plain label. Restricted states
// reuse the amber "pending" treatment; enabled is green; the rest stay neutral.
const STATE_BADGE: Record<PayoutState, { status: StatusType; label: string }> = {
  enabled: { status: "received", label: "Payouts enabled" },
  under_review: { status: "payment-pending", label: "Under review" },
  incomplete: { status: "pending", label: "Action needed" },
  not_started: { status: "payment-not-sent", label: "Not started" },
};

function payoutState(pub: Tables<"publishers">): PayoutState {
  if (pub.stripe_payouts_enabled) return "enabled";
  if (!pub.stripe_account_id) return "not_started";
  if (pub.stripe_details_submitted) return "under_review";
  return "incomplete";
}

export const AdminPayouts = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayouts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("publishers")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const publishers = (data || []) as Tables<"publishers">[];

      // Resolve emails in one query keyed by user_id.
      const userIds = publishers.map((p) => p.user_id).filter(Boolean);
      const emailByUser = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, email")
          .in("id", userIds);
        for (const u of users || []) emailByUser.set(u.id, u.email);
      }

      const transformed: PayoutRow[] = publishers.map((pub) => {
        const state = payoutState(pub);
        const outstanding = humanizeRequirements(
          pub.stripe_requirements_due as StripeRequirementsDue | null
        );
        return {
          id: pub.id,
          name: pub.company_name || "Unknown Publisher",
          email: emailByUser.get(pub.user_id) || "—",
          state,
          outstanding: outstanding.length > 0 ? outstanding.join(", ") : "—",
          accountCreated: pub.stripe_account_created_at
            ? new Date(pub.stripe_account_created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "—",
          connected: !!pub.stripe_account_id,
        };
      });

      setRows(transformed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch payout status");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const filteredRows = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const connectedCount = rows.filter((r) => r.connected).length;
  const enabledCount = rows.filter((r) => r.state === "enabled").length;
  // Restricted = connected but cannot yet receive payouts (the drop-off).
  const restrictedCount = rows.filter((r) => r.connected && r.state !== "enabled").length;

  const columns = [
    { key: "name", header: "Publisher", sortable: true },
    { key: "email", header: "Contact Email" },
    {
      key: "state",
      header: "Payout Status",
      render: (value: unknown) => {
        const cfg = STATE_BADGE[value as PayoutState];
        return <StatusBadge status={cfg.status} label={cfg.label} />;
      },
    },
    { key: "outstanding", header: "Outstanding" },
    { key: "accountCreated", header: "Account Created", sortable: true },
    {
      key: "actions",
      header: "",
      align: "right" as const,
      render: (_: unknown, row: PayoutRow) => (
        <ButtonSecondary
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/publishers/${row.id}`);
          }}
          className="text-caption py-1 px-3"
        >
          View
        </ButtonSecondary>
      ),
    },
  ];

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingScreen message="Loading payout status..." />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <EmptyState
            icon={<AlertCircle className="w-12 h-12" />}
            title="Something went wrong"
            description={error}
            action={<ButtonPrimary onClick={fetchPayouts}>Try Again</ButtonPrimary>}
          />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <BackNavigation title="Payouts" onBack={() => navigate("/admin")} />

      {/* Stats Row — drop-off at a glance */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Connected Accounts" value={connectedCount} />
          <StatCard label="Payouts Enabled" value={enabledCount} />
          <StatCard label="Cannot Receive Payments" value={restrictedCount} />
        </div>
      </div>

      {/* Search */}
      <div className="px-4 md:px-6 pb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <FormInput
            placeholder="Search publishers..."
            value={searchTerm}
            onChange={setSearchTerm}
            className="pl-10"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="px-4 md:px-6 pb-8">
        <div className="card-neesh">
          {filteredRows.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="w-12 h-12" />}
              title="No publishers found"
              description="There are no publishers matching your search."
            />
          ) : (
            <DataTable
              columns={columns}
              data={filteredRows}
              onRowClick={(row) => navigate(`/admin/publishers/${row.id}`)}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPayouts;
