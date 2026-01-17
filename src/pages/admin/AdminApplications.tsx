import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Store, Check, X, Pause, ClipboardList, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminLayout, StatCard, ConfirmationModal } from "@/components/admin";
import { ApplicationDetailSlideOver, ApplicationData, ApplicationNote } from "@/components/admin/ApplicationDetailSlideOver";
import { BackNavigation, TabNavigation, DataTable, StatusBadge, ButtonPrimary, ButtonSecondary, FormInput, EmptyState } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
import { useApplications } from "@/hooks/useApplications";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ApplicationRow {
  id: string;
  name: string;
  type: 'Publisher' | 'Retailer';
  email: string;
  contact?: string;
  location?: string;
  submittedDate: string;
  submittedRelative: string;
  status: 'pending' | 'received' | 'unfulfilled' | 'new-order';
  originalType: 'publisher' | 'retailer';
  originalStatus: 'pending' | 'approved' | 'rejected' | 'on_hold' | 'waitlisted';
  notes: ApplicationNote[];
  data: Record<string, any>;
  [key: string]: unknown;
}

// Status filter options
const STATUS_FILTERS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Declined' },
  { id: 'on_hold', label: 'On Hold' },
];

const ITEMS_PER_PAGE = 20;

export const AdminApplications = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showBulkApprove, setShowBulkApprove] = useState(false);
  const [showBulkReject, setShowBulkReject] = useState(false);
  const [showBulkHold, setShowBulkHold] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Slide-over state
  const [selectedApplication, setSelectedApplication] = useState<ApplicationData | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // Sort state
  const [sortColumn, setSortColumn] = useState<string>('submittedDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { applications, isLoading, error, approveApplication, rejectApplication, refetch } = useApplications();

  // Calculate stats
  const stats = useMemo(() => {
    const pending = applications.filter(a => a.status === 'pending').length;
    const approvedThisWeek = applications.filter(a => {
      if (a.status !== 'approved' || !a.reviewed_at) return false;
      const reviewedDate = new Date(a.reviewed_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return reviewedDate >= weekAgo;
    }).length;
    const publishers = applications.filter(a => a.type === 'publisher').length;
    const retailers = applications.filter(a => a.type === 'retailer').length;
    return { pending, approvedThisWeek, publishers, retailers };
  }, [applications]);

  // Create tabs with counts
  const tabs = useMemo(() => [
    { id: "all", label: `All (${applications.length})` },
    { id: "publishers", label: `Publishers (${stats.publishers})` },
    { id: "retailers", label: `Retailers (${stats.retailers})` },
  ], [applications.length, stats.publishers, stats.retailers]);

  // Filter and transform applications
  const tableData: ApplicationRow[] = useMemo(() => {
    let filtered = applications;

    // Filter by type tab
    if (activeTab === 'publishers') {
      filtered = filtered.filter(a => a.type === 'publisher');
    } else if (activeTab === 'retailers') {
      filtered = filtered.filter(a => a.type === 'retailer');
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(app => 
        app.name.toLowerCase().includes(search) ||
        app.email.toLowerCase().includes(search) ||
        (app.data?.shop_address || '').toLowerCase().includes(search) ||
        (app.data?.shipping_city || '').toLowerCase().includes(search) ||
        (app.data?.city || '').toLowerCase().includes(search)
      );
    }

    // Transform to table format
    return filtered.map(app => {
      const location = app.data?.city 
        ? `${app.data.city}${app.data.state ? `, ${app.data.state}` : ''}${app.data.country ? `, ${app.data.country}` : ''}`
        : app.data?.shipping_city 
          ? `${app.data.shipping_city}${app.data.shipping_state ? `, ${app.data.shipping_state}` : ''}`
          : undefined;

      const contactName = app.data?.buyer_name || app.data?.first_name 
        ? `${app.data.first_name || ''} ${app.data.last_name || ''}`.trim() || app.data?.buyer_name
        : undefined;

      // Map notes from data if present
      const notes: ApplicationNote[] = app.data?.notes || [];

      return {
        id: app.id,
        name: app.name,
        type: app.type === 'publisher' ? 'Publisher' as const : 'Retailer' as const,
        email: app.email,
        contact: contactName,
        location,
        submittedDate: new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        submittedRelative: formatDistanceToNow(new Date(app.submitted_at), { addSuffix: true }),
        status: app.status === 'approved' ? 'received' : app.status === 'rejected' ? 'unfulfilled' : 'pending',
        originalType: app.type,
        originalStatus: app.status as 'pending' | 'approved' | 'rejected' | 'on_hold' | 'waitlisted',
        notes,
        data: app.data,
      };
    });
  }, [applications, activeTab, statusFilter, searchTerm]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...tableData];
    sorted.sort((a, b) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];
      
      if (sortColumn === 'submittedDate') {
        aVal = new Date(a.data?.created_at || a.submittedDate).getTime();
        bVal = new Date(b.data?.created_at || b.submittedDate).getTime();
      }
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal?.toLowerCase() || '';
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [tableData, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedData.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedData, currentPage]);

  // Reset page when filters change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleSort = (columnKey: string, direction: 'asc' | 'desc') => {
    setSortColumn(columnKey);
    setSortDirection(direction);
  };

  // Open slide-over for application
  const handleRowClick = (row: ApplicationRow) => {
    const appData: ApplicationData = {
      id: row.id,
      type: row.originalType,
      status: row.originalStatus,
      name: row.name,
      email: row.email,
      phone: row.data?.phone,
      website: row.data?.social_website_link || row.data?.shop_url,
      instagram: row.data?.instagram_handle,
      location: row.location,
      submitted_at: row.data?.created_at || row.data?.submitted_at || '',
      reviewed_at: row.data?.reviewed_at,
      notes: row.notes,
      data: row.data,
    };
    setSelectedApplication(appData);
    setIsSlideOverOpen(true);
  };

  // Navigate between applications in slide-over
  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (!selectedApplication) return;
    const currentIndex = sortedData.findIndex(a => a.id === selectedApplication.id);
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < sortedData.length) {
      const row = sortedData[newIndex];
      handleRowClick(row);
    }
  }, [selectedApplication, sortedData]);

  const currentIndex = selectedApplication ? sortedData.findIndex(a => a.id === selectedApplication.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < sortedData.length - 1;

  // Bulk actions
  const handleBulkApprove = async () => {
    let successCount = 0;
    for (const id of selectedRows) {
      const app = applications.find(a => a.id === id);
      if (app) {
        const success = await approveApplication(id, app.type);
        if (success) successCount++;
      }
    }
    toast.success(`${successCount} application${successCount !== 1 ? 's' : ''} approved`);
    setShowBulkApprove(false);
    setSelectedRows([]);
  };

  const handleBulkReject = async () => {
    let successCount = 0;
    for (const id of selectedRows) {
      const app = applications.find(a => a.id === id);
      if (app) {
        const success = await rejectApplication(id, app.type, 'Bulk rejection');
        if (success) successCount++;
      }
    }
    toast.success(`${successCount} application${successCount !== 1 ? 's' : ''} declined`);
    setShowBulkReject(false);
    setSelectedRows([]);
  };

  // Quick action handlers
  const handleQuickApprove = async (id: string, type: 'publisher' | 'retailer') => {
    return approveApplication(id, type);
  };

  const handleQuickReject = async (id: string, type: 'publisher' | 'retailer', reason: string) => {
    return rejectApplication(id, type, reason);
  };

  // TODO: Implement hold functionality in useApplications
  const handleHold = async (id: string, type: 'publisher' | 'retailer') => {
    console.log('Hold application:', id, type);
    toast.info('Hold functionality coming soon');
    return true;
  };

  // TODO: Implement notes functionality
  const handleAddNote = async (id: string, note: string) => {
    console.log('Add note to application:', id, note);
    toast.success('Note added');
    return true;
  };

  const columns = [
    { 
      key: "type", 
      header: "",
      render: (value: unknown) => (
        <div className="flex items-center justify-center">
          {value === 'Publisher' ? (
            <FileText className="w-4 h-4 text-accent" />
          ) : (
            <Store className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      )
    },
    { key: "name", header: "Business Name", sortable: true },
    { 
      key: "contact", 
      header: "Contact",
      render: (_: unknown, row: ApplicationRow) => (
        <div className="flex flex-col">
          {row.contact && <span className="text-body">{row.contact}</span>}
          <span className="text-caption text-muted-foreground">{row.email}</span>
        </div>
      )
    },
    { 
      key: "location", 
      header: "Location",
      render: (value: unknown) => (
        <span className="text-body text-muted-foreground">{value as string || '—'}</span>
      )
    },
    { 
      key: "submittedRelative", 
      header: "Submitted", 
      sortable: true,
      render: (value: unknown) => (
        <span className="text-caption text-muted-foreground">{value as string}</span>
      )
    },
    { 
      key: "status", 
      header: "Status",
      render: (value: unknown) => <StatusBadge status={value as any} />
    },
    {
      key: "actions",
      header: "",
      align: "right" as const,
      render: (_: unknown, row: ApplicationRow) => (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {row.originalStatus === 'pending' && (
            <>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const success = await handleQuickApprove(row.id, row.originalType);
                  if (success) toast.success('Application approved');
                }}
                className="p-1.5 rounded hover:bg-status-success/20 text-status-success transition-colors"
                title="Approve"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const success = await handleQuickReject(row.id, row.originalType, 'Quick rejection');
                  if (success) toast.success('Application declined');
                }}
                className="p-1.5 rounded hover:bg-status-error/20 text-status-error-text transition-colors"
                title="Decline"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleHold(row.id, row.originalType);
                }}
                className="p-1.5 rounded hover:bg-status-pending/20 text-status-pending-text transition-colors"
                title="Put On Hold"
              >
                <Pause className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

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

      {/* Stats Summary */}
      <div className="px-4 md:px-6 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard 
            label="Pending Review" 
            value={stats.pending} 
            highlight={stats.pending > 0 ? 'warning' : 'default'}
            onClick={() => handleStatusFilter('pending')}
          />
          <StatCard 
            label="Approved This Week" 
            value={stats.approvedThisWeek}
            highlight="success"
          />
          <StatCard 
            label="Total Publishers" 
            value={stats.publishers}
          />
          <StatCard 
            label="Total Retailers" 
            value={stats.retailers}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-6 pb-4">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </div>

      {/* Filters & Search */}
      <div className="px-4 md:px-6 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <FormInput
              placeholder="Search by name, email, location..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="pl-10"
            />
          </div>
          
          {/* Status filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map(filter => (
              <button
                key={filter.id}
                onClick={() => handleStatusFilter(filter.id)}
                className={`px-3 py-1.5 rounded-full text-caption font-medium transition-colors ${
                  statusFilter === filter.id
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-secondary hover:bg-secondary/80 text-foreground'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="px-4 md:px-6 pb-8">
        <div className="card-neesh">
          {paginatedData.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="w-12 h-12" />}
              title={searchTerm || statusFilter !== 'all' ? "No applications match your filters" : "No applications yet"}
              description={
                searchTerm || statusFilter !== 'all' 
                  ? "Try adjusting your search or filters"
                  : "Share your publisher and retailer application links to start receiving applications"
              }
              action={
                (searchTerm || statusFilter !== 'all') && (
                  <ButtonSecondary onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
                    Clear Filters
                  </ButtonSecondary>
                )
              }
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={paginatedData}
                selectable
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                onRowClick={handleRowClick}
                onSort={handleSort}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
              />
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-caption text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sortedData.length)} of {sortedData.length} applications
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-caption px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedRows.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-60 p-4 bg-background border-t border-border shadow-neesh-lg z-40">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <span className="text-body font-medium">{selectedRows.length} selected</span>
            <div className="flex items-center gap-2">
              <ButtonPrimary 
                onClick={() => setShowBulkApprove(true)} 
                className="gap-1.5 bg-status-success hover:bg-status-success/90"
              >
                <Check className="w-4 h-4" />
                Approve
              </ButtonPrimary>
              <ButtonSecondary 
                onClick={() => setShowBulkReject(true)} 
                className="gap-1.5 text-status-error-text"
              >
                <X className="w-4 h-4" />
                Decline
              </ButtonSecondary>
              <ButtonSecondary 
                onClick={() => setShowBulkHold(true)} 
                className="gap-1.5"
              >
                <Pause className="w-4 h-4" />
                On Hold
              </ButtonSecondary>
              <button
                onClick={() => setSelectedRows([])}
                className="text-caption text-muted-foreground hover:text-foreground ml-2"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Detail Slide-Over */}
      <ApplicationDetailSlideOver
        application={selectedApplication}
        isOpen={isSlideOverOpen}
        onClose={() => {
          setIsSlideOverOpen(false);
          setSelectedApplication(null);
        }}
        onApprove={handleQuickApprove}
        onReject={handleQuickReject}
        onHold={handleHold}
        onAddNote={handleAddNote}
        onNavigate={handleNavigate}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />

      {/* Bulk Approve Modal */}
      <ConfirmationModal
        isOpen={showBulkApprove}
        onClose={() => setShowBulkApprove(false)}
        onConfirm={handleBulkApprove}
        title="Approve Applications"
        message={`Approve ${selectedRows.length} application${selectedRows.length !== 1 ? 's' : ''}? This will send approval emails to all selected applicants.`}
        confirmLabel="Approve All"
      />

      {/* Bulk Reject Modal */}
      <ConfirmationModal
        isOpen={showBulkReject}
        onClose={() => setShowBulkReject(false)}
        onConfirm={handleBulkReject}
        title="Decline Applications"
        message={`Decline ${selectedRows.length} application${selectedRows.length !== 1 ? 's' : ''}?`}
        confirmLabel="Decline All"
        confirmVariant="destructive"
      />

      {/* Bulk Hold Modal */}
      <ConfirmationModal
        isOpen={showBulkHold}
        onClose={() => setShowBulkHold(false)}
        onConfirm={() => {
          toast.info('Hold functionality coming soon');
          setShowBulkHold(false);
          setSelectedRows([]);
        }}
        title="Place On Hold"
        message={`Place ${selectedRows.length} application${selectedRows.length !== 1 ? 's' : ''} on hold?`}
        confirmLabel="Place On Hold"
      />
    </AdminLayout>
  );
};

export default AdminApplications;

// TODO: Email templates preview before sending
// TODO: Batch email customization
// TODO: Application scoring/rating system
// TODO: Auto-approve rules based on criteria
// TODO: Export applications to CSV
// TODO: Keyboard shortcuts: 'a' to approve, 'd' to decline, 'h' for hold
