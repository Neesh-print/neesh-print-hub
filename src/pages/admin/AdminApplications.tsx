import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, AlertCircle } from "lucide-react";
import { AdminLayout, ConfirmationModal } from "@/components/admin";
import { BackNavigation, TabNavigation, DataTable, StatusBadge, ButtonPrimary, ButtonSecondary, FormInput, EmptyState } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
import { useApplications } from "@/hooks/useApplications";
import { toast } from "sonner";

interface ApplicationRow {
  id: string;
  name: string;
  type: 'Publisher' | 'Retailer';
  email: string;
  submittedDate: string;
  status: 'pending' | 'received' | 'unfulfilled';
  originalType: 'publisher' | 'retailer';
  [key: string]: unknown;
}

const tabs = [
  { id: "all", label: "All" },
  { id: "publishers", label: "Publishers" },
  { id: "retailers", label: "Retailers" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export const AdminApplications = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showBulkApprove, setShowBulkApprove] = useState(false);
  const [showBulkReject, setShowBulkReject] = useState(false);

  // Determine filter options based on active tab
  const getFilterOptions = () => {
    switch (activeTab) {
      case "publishers":
        return { type: 'publisher' as const };
      case "retailers":
        return { type: 'retailer' as const };
      case "approved":
        return { status: 'approved' as const };
      case "rejected":
        return { status: 'rejected' as const };
      default:
        return {};
    }
  };

  const { applications, isLoading, error, approveApplication, rejectApplication, refetch } = useApplications(getFilterOptions());

  // Transform applications to table format
  const tableData: ApplicationRow[] = applications
    .filter((app) => {
      if (!searchTerm) return true;
      return app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             app.email.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .map((app) => ({
      id: app.id,
      name: app.name,
      type: app.type === 'publisher' ? 'Publisher' : 'Retailer',
      email: app.email,
      submittedDate: new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: app.status === 'approved' ? 'received' : app.status === 'rejected' ? 'unfulfilled' : 'pending',
      originalType: app.type,
    }));

  const columns = [
    { key: "name", header: "Applicant Name", sortable: true },
    { 
      key: "type", 
      header: "Type",
      render: (value: unknown) => (
        <span className={`px-2 py-0.5 rounded text-caption font-medium ${
          value === 'Publisher' ? 'bg-accent/10 text-accent' : 'bg-secondary text-foreground'
        }`}>
          {value as string}
        </span>
      )
    },
    { key: "email", header: "Email" },
    { key: "submittedDate", header: "Submitted", sortable: true },
    { 
      key: "status", 
      header: "Status",
      render: (value: unknown) => {
        const statusMap: Record<string, 'pending' | 'received' | 'unfulfilled'> = {
          pending: 'pending',
          received: 'received',
          unfulfilled: 'unfulfilled',
        };
        return <StatusBadge status={statusMap[value as string] || 'pending'} />;
      }
    },
    {
      key: "actions",
      header: "",
      align: "right" as const,
      render: (_: unknown, row: ApplicationRow) => (
        <ButtonSecondary 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/applications/${row.id}`);
          }}
          className="text-caption py-1 px-3"
        >
          Review
        </ButtonSecondary>
      ),
    },
  ];

  const handleBulkApprove = async () => {
    for (const id of selectedRows) {
      const app = applications.find(a => a.id === id);
      if (app) {
        await approveApplication(id, app.type);
      }
    }
    toast.success(`Approved ${selectedRows.length} applications`);
    setShowBulkApprove(false);
    setSelectedRows([]);
  };

  const handleBulkReject = async () => {
    for (const id of selectedRows) {
      const app = applications.find(a => a.id === id);
      if (app) {
        await rejectApplication(id, app.type, 'Bulk rejection');
      }
    }
    toast.success(`Rejected ${selectedRows.length} applications`);
    setShowBulkReject(false);
    setSelectedRows([]);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingScreen message="Loading applications..." />
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
            action={<ButtonPrimary onClick={refetch}>Try Again</ButtonPrimary>}
          />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <BackNavigation title="Applications" onBack={() => navigate("/admin")} />

      {/* Tabs */}
      <div className="px-4 md:px-6 pb-4">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* View Controls */}
      <div className="px-4 md:px-6 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <FormInput
              placeholder="Search applications..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="pl-10"
            />
          </div>
          <ButtonSecondary className="gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filter
          </ButtonSecondary>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <div className="px-4 md:px-6 pb-4">
          <div className="flex items-center gap-4 p-3 bg-secondary rounded-lg">
            <span className="text-body font-medium">{selectedRows.length} selected</span>
            <ButtonPrimary onClick={() => setShowBulkApprove(true)} className="py-1.5">
              Approve Selected
            </ButtonPrimary>
            <ButtonSecondary onClick={() => setShowBulkReject(true)} className="py-1.5 text-status-error-text">
              Reject Selected
            </ButtonSecondary>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="px-4 md:px-6 pb-8">
        <div className="card-neesh">
          {tableData.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="w-12 h-12" />}
              title="No applications found"
              description="There are no applications matching your current filters."
            />
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              selectable
              selectedRows={selectedRows}
              onSelectionChange={setSelectedRows}
              onRowClick={(row) => navigate(`/admin/applications/${row.id}`)}
            />
          )}
        </div>
      </div>

      {/* Bulk Approve Modal */}
      <ConfirmationModal
        isOpen={showBulkApprove}
        onClose={() => setShowBulkApprove(false)}
        onConfirm={handleBulkApprove}
        title="Approve Applications"
        message={`Are you sure you want to approve ${selectedRows.length} application(s)? This will create accounts and send approval emails.`}
        confirmLabel="Approve All"
      />

      {/* Bulk Reject Modal */}
      <ConfirmationModal
        isOpen={showBulkReject}
        onClose={() => setShowBulkReject(false)}
        onConfirm={handleBulkReject}
        title="Reject Applications"
        message={`Are you sure you want to reject ${selectedRows.length} application(s)?`}
        confirmLabel="Reject All"
        confirmVariant="destructive"
      />
    </AdminLayout>
  );
};

export default AdminApplications;
