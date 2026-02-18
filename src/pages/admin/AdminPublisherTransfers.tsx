import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Banknote,
  Clock,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Loader2,
} from "lucide-react";
import { AdminLayout, StatCard } from "@/components/admin";
import {
  BackNavigation,
  TabNavigation,
  DataTable,
  StatusBadge,
  ButtonPrimary,
  ButtonSecondary,
  FormInput,
} from "@/components/neesh";
import { usePublisherTransfers } from "@/hooks/usePublisherTransfers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const tabs = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "transferred", label: "Transferred" },
  { id: "failed", label: "Failed" },
];

export const AdminPublisherTransfers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isReleasing, setIsReleasing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const {
    transfers,
    isLoading,
    error,
    pendingTotal,
    transferredTotal,
    pendingCount,
    transferredCount,
    refetch,
  } = usePublisherTransfers();

  const filteredTransfers = useMemo(() => {
    return transfers
      .map((t) => ({
        id: t.id,
        date: t.created_at ? format(new Date(t.created_at), "MMM d, yyyy") : "",
        publisher: t.publisher_name || "Unknown",
        orderNumber: t.order_number || "N/A",
        gross: t.gross_amount,
        fee: t.platform_fee,
        net: t.net_amount,
        status: t.status,
        failureReason: t.failure_reason,
      }))
      .filter((t) => {
        const matchesSearch =
          t.publisher.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());

        if (activeTab === "all") return matchesSearch;
        return matchesSearch && t.status === activeTab;
      });
  }, [transfers, searchTerm, activeTab]);

  const handleReleaseSelected = async () => {
    setShowConfirmModal(false);
    setIsReleasing(true);

    try {
      const { data, error: releaseError } = await supabase.functions.invoke(
        "release-publisher-transfer",
        {
          body: { transferIds: selectedRows },
        }
      );

      if (releaseError) {
        toast({
          title: "Release Failed",
          description: releaseError.message,
          variant: "destructive",
        });
        return;
      }

      const successCount = data?.results?.filter(
        (r: { success: boolean }) => r.success
      ).length || 0;
      const failCount = data?.results?.filter(
        (r: { success: boolean }) => !r.success
      ).length || 0;

      toast({
        title: "Transfers Released",
        description: `${successCount} transferred${failCount > 0 ? `, ${failCount} failed` : ""}`,
        variant: failCount > 0 ? "destructive" : "default",
      });

      setSelectedRows([]);
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsReleasing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <StatusBadge status="pending" />;
      case "transferred":
        return <StatusBadge status="payment-received" />;
      case "failed":
        return <StatusBadge status="unfulfilled" />;
      default:
        return <StatusBadge status="pending" />;
    }
  };

  const columns = [
    { key: "date", header: "Date", sortable: true },
    { key: "publisher", header: "Publisher" },
    { key: "orderNumber", header: "Order #", sortable: true },
    {
      key: "gross",
      header: "Gross",
      align: "right" as const,
      render: (value: unknown) => `$${(value as number).toFixed(2)}`,
    },
    {
      key: "fee",
      header: "Fee",
      align: "right" as const,
      render: (value: unknown) => `$${(value as number).toFixed(2)}`,
    },
    {
      key: "net",
      header: "Net",
      align: "right" as const,
      render: (value: unknown) => (
        <span className="font-semibold">${(value as number).toFixed(2)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: unknown) => getStatusBadge(value as string),
    },
  ];

  if (error) {
    return (
      <AdminLayout>
        <BackNavigation title="Publisher Transfers" onBack={() => navigate("/admin")} />
        <div className="px-4 md:px-6 pb-8">
          <div className="card-neesh flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-10 h-10 text-status-error-text mb-3" />
            <h3 className="font-display font-semibold text-heading text-foreground mb-1">
              Something went wrong
            </h3>
            <p className="text-body text-muted-foreground mb-4">{error}</p>
            <ButtonSecondary onClick={refetch}>Try Again</ButtonSecondary>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <BackNavigation title="Publisher Transfers" onBack={() => navigate("/admin")} />

      {/* Stats Row */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Pending"
            value={pendingCount}
            icon={<Clock className="w-5 h-5" />}
            highlight={pendingCount > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Pending Amount"
            value={`$${pendingTotal.toFixed(2)}`}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            label="Transferred"
            value={transferredCount}
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatCard
            label="Total Paid"
            value={`$${transferredTotal.toFixed(2)}`}
            icon={<Banknote className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-6 pb-4">
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Search */}
      <div className="px-4 md:px-6 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <FormInput
              placeholder="Search by publisher or order #..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <div className="px-4 md:px-6 pb-4">
          <div className="flex items-center gap-4 p-3 bg-secondary rounded-lg">
            <span className="text-body font-medium">{selectedRows.length} selected</span>
            <ButtonPrimary
              onClick={() => setShowConfirmModal(true)}
              disabled={isReleasing}
              className="py-1.5 gap-2"
            >
              {isReleasing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Releasing...
                </>
              ) : (
                <>
                  <Banknote className="w-4 h-4" />
                  Release Selected
                </>
              )}
            </ButtonPrimary>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card-neesh max-w-md mx-4 p-6">
            <h3 className="font-display font-semibold text-heading text-foreground mb-2">
              Confirm Transfer Release
            </h3>
            <p className="text-body text-muted-foreground mb-1">
              You are about to release <strong>{selectedRows.length}</strong> transfer
              {selectedRows.length > 1 ? "s" : ""} to publisher Stripe accounts.
            </p>
            <p className="text-body text-muted-foreground mb-6">
              This will move real funds. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <ButtonSecondary onClick={() => setShowConfirmModal(false)}>Cancel</ButtonSecondary>
              <ButtonPrimary onClick={handleReleaseSelected}>
                Yes, Release Funds
              </ButtonPrimary>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="px-4 md:px-6 pb-8">
        <div className="card-neesh">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-center">
                <Banknote className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-body text-muted-foreground">Loading transfers...</p>
              </div>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Banknote className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-display font-semibold text-heading text-foreground mb-1">
                {searchTerm || activeTab !== "all"
                  ? "No transfers match your filters"
                  : "No transfers yet"}
              </h3>
              <p className="text-body text-muted-foreground">
                {searchTerm || activeTab !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Transfer records will appear here after orders are placed"}
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredTransfers as unknown as Record<string, unknown>[]}
              selectable
              selectedRows={selectedRows}
              onSelectionChange={setSelectedRows}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPublisherTransfers;
