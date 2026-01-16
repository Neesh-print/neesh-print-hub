import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { AdminLayout, ConfirmationModal } from "@/components/admin";
import { BackNavigation, TabNavigation, DataTable, StatusBadge, ButtonPrimary, ButtonSecondary, FormInput } from "@/components/neesh";

interface Application {
  id: string;
  name: string;
  type: 'Publisher' | 'Retailer';
  email: string;
  submittedDate: string;
  status: 'pending' | 'received' | 'unfulfilled';
  [key: string]: unknown;
}

const mockApplications: Application[] = [
  { id: "1", name: "Kinfolk Magazine", type: "Publisher", email: "hello@kinfolk.com", submittedDate: "Jan 15, 2026", status: "pending" },
  { id: "2", name: "Chapters Books", type: "Retailer", email: "orders@chapters.com", submittedDate: "Jan 14, 2026", status: "pending" },
  { id: "3", name: "The Gourmand", type: "Publisher", email: "info@thegourmand.co.uk", submittedDate: "Jan 13, 2026", status: "received" },
  { id: "4", name: "Rare Device", type: "Retailer", email: "shop@raredevice.net", submittedDate: "Jan 12, 2026", status: "received" },
  { id: "5", name: "Drift Magazine", type: "Publisher", email: "hello@driftmag.com", submittedDate: "Jan 11, 2026", status: "pending" },
  { id: "6", name: "McNally Jackson", type: "Retailer", email: "buyers@mcnallyjackson.com", submittedDate: "Jan 10, 2026", status: "pending" },
  { id: "7", name: "Apartamento", type: "Publisher", email: "contact@apartamentomagazine.com", submittedDate: "Jan 9, 2026", status: "pending" },
  { id: "8", name: "Powell's Books", type: "Retailer", email: "magazines@powells.com", submittedDate: "Jan 8, 2026", status: "received" },
  { id: "9", name: "Cereal Magazine", type: "Publisher", email: "hello@readcereal.com", submittedDate: "Jan 7, 2026", status: "pending" },
  { id: "10", name: "City Lights Books", type: "Retailer", email: "books@citylights.com", submittedDate: "Jan 6, 2026", status: "unfulfilled" },
  { id: "11", name: "Monocle", type: "Publisher", email: "retail@monocle.com", submittedDate: "Jan 5, 2026", status: "pending" },
  { id: "12", name: "Skylight Books", type: "Retailer", email: "info@skylightbooks.com", submittedDate: "Jan 4, 2026", status: "received" },
  { id: "13", name: "MacGuffin Magazine", type: "Publisher", email: "hello@macguffin.nl", submittedDate: "Jan 3, 2026", status: "received" },
  { id: "14", name: "The Strand", type: "Retailer", email: "buyers@strandbooks.com", submittedDate: "Jan 2, 2026", status: "pending" },
  { id: "15", name: "Offscreen Magazine", type: "Publisher", email: "kai@offscreenmag.com", submittedDate: "Jan 1, 2026", status: "unfulfilled" },
];

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

  const filteredApplications = mockApplications.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          app.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "publishers") return matchesSearch && app.type === "Publisher";
    if (activeTab === "retailers") return matchesSearch && app.type === "Retailer";
    if (activeTab === "approved") return matchesSearch && app.status === "received";
    if (activeTab === "rejected") return matchesSearch && app.status === "unfulfilled";
    return matchesSearch;
  });

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
      render: (_: unknown, row: Application) => (
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

  const handleBulkApprove = () => {
    console.log("Approving:", selectedRows);
    setShowBulkApprove(false);
    setSelectedRows([]);
  };

  const handleBulkReject = () => {
    console.log("Rejecting:", selectedRows);
    setShowBulkReject(false);
    setSelectedRows([]);
  };

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
          <DataTable
            columns={columns}
            data={filteredApplications}
            selectable
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            onRowClick={(row) => navigate(`/admin/applications/${row.id}`)}
          />
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
