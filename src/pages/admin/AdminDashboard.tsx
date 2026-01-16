import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { AdminLayout, StatCard } from "@/components/admin";
import { BackNavigation, DataTable, StatusBadge, ButtonSecondary } from "@/components/neesh";

// Mock data
const mockNeedsAttention = [
  { id: "1", type: "Application", description: "New publisher application from Kinfolk Magazine", date: "2h ago", status: "pending" as const },
  { id: "2", type: "Order", description: "Order #0045 payment overdue", date: "5h ago", status: "payment-pending" as const },
  { id: "3", type: "Application", description: "Retailer application from Chapters Books", date: "1d ago", status: "pending" as const },
  { id: "4", type: "Payout", description: "Payout request from Cereal Magazine", date: "1d ago", status: "pending" as const },
  { id: "5", type: "Application", description: "New publisher application from Apartamento", date: "2d ago", status: "pending" as const },
];

const mockRecentApplications = [
  { id: "1", name: "Kinfolk Magazine", type: "Publisher", date: "2h ago", status: "pending" as const },
  { id: "2", name: "Chapters Books", type: "Retailer", date: "1d ago", status: "pending" as const },
  { id: "3", name: "The Gourmand", type: "Publisher", date: "2d ago", status: "received" as const },
  { id: "4", name: "Rare Device", type: "Retailer", date: "3d ago", status: "received" as const },
  { id: "5", name: "Drift Magazine", type: "Publisher", date: "4d ago", status: "pending" as const },
];

const mockRecentOrders = [
  { id: "#0049", retailer: "Powell's Books", total: 450.00, date: "2h ago", status: "pending" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0048", retailer: "McNally Jackson", total: 280.00, date: "5h ago", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0047", retailer: "Skylight Books", total: 320.00, date: "1d ago", status: "unfulfilled" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0046", retailer: "City Lights", total: 180.00, date: "2d ago", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0045", retailer: "The Strand", total: 560.00, date: "3d ago", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
];

export const AdminDashboard = () => {
  const navigate = useNavigate();

  const attentionColumns = [
    { key: "type", header: "Type" },
    { key: "description", header: "Description" },
    { key: "date", header: "Date" },
    { 
      key: "status", 
      header: "Status", 
      render: (value: unknown) => <StatusBadge status={value as 'pending' | 'payment-pending'} /> 
    },
    {
      key: "actions",
      header: "",
      align: "right" as const,
      render: (_: unknown, row: Record<string, unknown>) => (
        <ButtonSecondary 
          onClick={(e) => {
            e.stopPropagation();
            if (row.type === 'Application') navigate('/admin/applications');
            else if (row.type === 'Order') navigate('/admin/orders');
          }}
          className="text-caption py-1 px-2"
        >
          Review
        </ButtonSecondary>
      ),
    },
  ];

  const orderColumns = [
    { key: "id", header: "Order #" },
    { key: "retailer", header: "Retailer" },
    { key: "total", header: "Total", render: (value: unknown) => `$${(value as number).toFixed(2)}` },
    { key: "date", header: "Date" },
    { key: "status", header: "Status", render: (value: unknown) => <StatusBadge status={value as 'pending' | 'received' | 'unfulfilled'} /> },
  ];

  return (
    <AdminLayout>
      <BackNavigation title="Dashboard" onBack={() => navigate("/")} />

      {/* Top Metrics Row */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Pending Applications"
            value={7}
            subtitle="4 publishers, 3 retailers"
            onClick={() => navigate("/admin/applications")}
            highlight="warning"
          />
          <StatCard
            label="Orders This Week"
            value={23}
            trend={{ value: 12, direction: 'up' }}
            onClick={() => navigate("/admin/orders")}
          />
          <StatCard
            label="Revenue This Month"
            value="$4,850.00"
            trend={{ value: 8.5, direction: 'up' }}
            onClick={() => navigate("/admin/analytics")}
          />
          <StatCard
            label="Active Publishers"
            value={12}
            subtitle="47 magazines listed"
            onClick={() => navigate("/admin/publishers")}
          />
        </div>
      </div>

      {/* Needs Attention Section */}
      <div className="px-4 md:px-6 pb-6">
        <div className="card-neesh">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-heading text-foreground">Needs Attention</h3>
            <button 
              onClick={() => navigate("/admin/applications")}
              className="text-caption text-accent hover:underline"
            >
              View all
            </button>
          </div>
          <DataTable
            columns={attentionColumns}
            data={mockNeedsAttention as unknown as Record<string, unknown>[]}
          />
        </div>
      </div>

      {/* Two Column Section */}
      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Applications */}
          <div className="card-neesh">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-heading text-foreground">Recent Applications</h3>
              <button 
                onClick={() => navigate("/admin/applications")}
                className="text-caption text-accent hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-3">
              {mockRecentApplications.map((app) => (
                <div 
                  key={app.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/applications/${app.id}`)}
                >
                  <div>
                    <p className="font-medium text-body text-foreground">{app.name}</p>
                    <p className="text-caption text-muted-foreground">{app.type} • {app.date}</p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="card-neesh">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-heading text-foreground">Recent Orders</h3>
              <button 
                onClick={() => navigate("/admin/orders")}
                className="text-caption text-accent hover:underline"
              >
                View all
              </button>
            </div>
            <DataTable
              columns={orderColumns}
              data={mockRecentOrders}
              onRowClick={(order) => navigate(`/admin/orders/${String(order.id).replace("#", "")}`)}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
