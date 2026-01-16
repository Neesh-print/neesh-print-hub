import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Globe, Instagram, Mail, MapPin, MessageSquare, Edit, DollarSign } from "lucide-react";
import { AdminLayout, ConfirmationModal } from "@/components/admin";
import { BackNavigation, InfoCard, MagazineCard, DataTable, StatusBadge, ButtonPrimary, ButtonSecondary } from "@/components/neesh";

// Mock data
const mockPublisher = {
  id: "1",
  name: "Kinfolk Magazine",
  avatar: "/placeholder.svg",
  website: "https://kinfolk.com",
  email: "hello@kinfolk.com",
  instagram: "@kinfolkmag",
  location: "Portland, OR",
  bio: "Kinfolk is an independent slow lifestyle magazine that explores ways to simplify life, nurture creativity, and build community. Founded in 2011, we've grown to a globally recognized publication.",
  memberSince: "March 15, 2024",
  lastActive: "2 hours ago",
  status: "received" as const,
  totalSales: 4520.00,
  totalOrders: 89,
  avgOrderValue: 50.79,
  currentBalance: 1280.00,
};

const mockMagazines = [
  { id: "1", title: "Kinfolk Issue 50", coverImage: "/placeholder.svg", price: 18.00, publisher: "Kinfolk" },
  { id: "2", title: "Kinfolk Issue 49", coverImage: "/placeholder.svg", price: 18.00, publisher: "Kinfolk" },
  { id: "3", title: "Kinfolk Issue 48", coverImage: "/placeholder.svg", price: 18.00, publisher: "Kinfolk" },
  { id: "4", title: "Kinfolk Issue 47", coverImage: "/placeholder.svg", price: 16.00, publisher: "Kinfolk" },
  { id: "5", title: "Kinfolk Issue 46", coverImage: "/placeholder.svg", price: 16.00, publisher: "Kinfolk" },
  { id: "6", title: "Kinfolk Issue 45", coverImage: "/placeholder.svg", price: 16.00, publisher: "Kinfolk" },
  { id: "7", title: "Kinfolk Issue 44", coverImage: "/placeholder.svg", price: 14.00, publisher: "Kinfolk" },
  { id: "8", title: "Kinfolk Issue 43", coverImage: "/placeholder.svg", price: 14.00, publisher: "Kinfolk" },
];

const mockRecentOrders = [
  { id: "#0089", retailer: "Powell's Books", total: 180.00, date: "Jan 15, 2026", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0085", retailer: "McNally Jackson", total: 144.00, date: "Jan 12, 2026", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0081", retailer: "City Lights", total: 90.00, date: "Jan 8, 2026", status: "pending" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0078", retailer: "Skylight Books", total: 72.00, date: "Jan 5, 2026", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0072", retailer: "The Strand", total: 216.00, date: "Jan 2, 2026", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
];

export const AdminPublisherDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const publisher = mockPublisher;

  const orderColumns = [
    { key: "id", header: "Order #" },
    { key: "retailer", header: "Retailer" },
    { key: "total", header: "Total", render: (value: unknown) => `$${(value as number).toFixed(2)}` },
    { key: "date", header: "Date" },
    { key: "status", header: "Status", render: (value: unknown) => <StatusBadge status={value as 'pending' | 'received'} /> },
  ];

  const handleSuspend = () => {
    console.log("Suspending publisher:", id);
    setShowSuspendModal(false);
  };

  const statusLabels: Record<string, string> = {
    received: 'Active',
    pending: 'Inactive',
    unfulfilled: 'Suspended',
  };

  return (
    <AdminLayout>
      <BackNavigation title={publisher.name} onBack={() => navigate("/admin/publishers")} />

      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="card-neesh">
              <div className="flex items-start gap-4 mb-4">
                <img 
                  src={publisher.avatar} 
                  alt={publisher.name}
                  className="w-16 h-16 rounded-full bg-secondary object-cover"
                />
                <div className="flex-1">
                  <h2 className="font-display font-bold text-heading text-foreground">{publisher.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-body text-muted-foreground">{publisher.location}</span>
                  </div>
                </div>
              </div>

              <p className="text-body text-foreground mb-4">{publisher.bio}</p>

              <div className="space-y-2">
                <a href={publisher.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-body text-accent hover:underline">
                  <Globe className="w-4 h-4" />
                  {publisher.website}
                </a>
                <a href={`mailto:${publisher.email}`} className="flex items-center gap-2 text-body text-foreground hover:text-accent">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {publisher.email}
                </a>
                <div className="flex items-center gap-2 text-body text-foreground">
                  <Instagram className="w-4 h-4 text-muted-foreground" />
                  {publisher.instagram}
                </div>
              </div>
            </div>

            {/* Account Status */}
            <InfoCard title="Account Status">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Status</span>
                  <StatusBadge status={publisher.status} label={statusLabels[publisher.status]} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Member Since</span>
                  <span className="text-body text-foreground">{publisher.memberSince}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Last Active</span>
                  <span className="text-body text-foreground">{publisher.lastActive}</span>
                </div>
                <ButtonSecondary 
                  onClick={() => setShowSuspendModal(true)} 
                  className="w-full mt-2 text-status-error-text"
                >
                  Suspend Account
                </ButtonSecondary>
              </div>
            </InfoCard>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Performance */}
            <InfoCard title="Performance">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-caption text-muted-foreground">Total Sales</p>
                  <p className="font-display font-bold text-display-sm text-foreground">${publisher.totalSales.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Total Orders</p>
                  <p className="font-display font-bold text-display-sm text-foreground">{publisher.totalOrders}</p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Avg Order Value</p>
                  <p className="font-display font-bold text-display-sm text-foreground">${publisher.avgOrderValue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Current Balance</p>
                  <p className="font-display font-bold text-display-sm text-accent">${publisher.currentBalance.toFixed(2)}</p>
                </div>
              </div>
            </InfoCard>

            {/* Magazines */}
            <div className="card-neesh">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-heading text-foreground">Magazines ({mockMagazines.length})</h3>
                <ButtonSecondary className="text-caption py-1">Add Magazine</ButtonSecondary>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {mockMagazines.slice(0, 8).map((mag) => (
                  <div key={mag.id} className="cursor-pointer">
                    <img 
                      src={mag.coverImage} 
                      alt={mag.title}
                      className="aspect-[3/4] object-cover rounded bg-secondary"
                    />
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

            {/* Admin Actions */}
            <div className="card-neesh">
              <h3 className="font-display font-semibold text-heading text-foreground mb-4">Admin Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <ButtonSecondary className="gap-2">
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </ButtonSecondary>
                <ButtonSecondary onClick={() => setShowAdjustModal(true)} className="gap-2">
                  <DollarSign className="w-4 h-4" />
                  Adjust Balance
                </ButtonSecondary>
                <ButtonSecondary className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </ButtonSecondary>
                <ButtonSecondary onClick={() => navigate("/admin/orders")} className="gap-2">
                  View All Orders
                </ButtonSecondary>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Suspend Modal */}
      <ConfirmationModal
        isOpen={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        onConfirm={handleSuspend}
        title="Suspend Publisher"
        message={`Are you sure you want to suspend ${publisher.name}? They will no longer be able to receive orders or access their account.`}
        confirmLabel="Suspend"
        confirmVariant="destructive"
      />

      {/* Adjust Balance Modal */}
      <ConfirmationModal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        onConfirm={() => setShowAdjustModal(false)}
        title="Adjust Balance"
        message="Enter the adjustment amount (positive or negative):"
        confirmLabel="Apply Adjustment"
      />
    </AdminLayout>
  );
};

export default AdminPublisherDetail;
