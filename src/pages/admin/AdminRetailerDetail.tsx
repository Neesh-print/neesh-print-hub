import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Globe, Mail, MapPin, MessageSquare, Edit, Phone } from "lucide-react";
import { AdminLayout, ConfirmationModal } from "@/components/admin";
import { BackNavigation, InfoCard, DataTable, StatusBadge, ButtonSecondary } from "@/components/neesh";

// Mock data
const mockRetailer = {
  id: "1",
  storeName: "Powell's Books",
  logo: "/placeholder.svg",
  website: "https://powells.com",
  email: "magazines@powells.com",
  phone: "+1 (503) 228-4651",
  contactPerson: "Sarah Mitchell",
  location: "Portland, OR",
  address: "1005 W Burnside St, Portland, OR 97209",
  description: "Powell's City of Books is the largest independent used and new bookstore in the world, occupying an entire city block in downtown Portland.",
  storeType: ["Independent Bookstore", "New & Used"],
  memberSince: "March 15, 2024",
  lastOrderDate: "January 15, 2026",
  status: "received" as const,
  totalOrders: 45,
  totalSpent: 4520.00,
  avgOrderValue: 100.44,
  favoritePublishers: ["Kinfolk Magazine", "Cereal Magazine", "Monocle"],
};

const mockRecentOrders = [
  { id: "#0089", total: 180.00, date: "Jan 15, 2026", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0085", total: 144.00, date: "Jan 12, 2026", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0081", total: 90.00, date: "Jan 8, 2026", status: "pending" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0078", total: 72.00, date: "Jan 5, 2026", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
  { id: "#0072", total: 216.00, date: "Jan 2, 2026", status: "received" as const, [Symbol.toPrimitive]: undefined } as Record<string, unknown>,
];

export const AdminRetailerDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  const retailer = mockRetailer;

  const orderColumns = [
    { key: "id", header: "Order #" },
    { key: "total", header: "Total", render: (value: unknown) => `$${(value as number).toFixed(2)}` },
    { key: "date", header: "Date" },
    { key: "status", header: "Status", render: (value: unknown) => <StatusBadge status={value as 'pending' | 'received'} /> },
  ];

  const handleSuspend = () => {
    console.log("Suspending retailer:", id);
    setShowSuspendModal(false);
  };

  const statusLabels: Record<string, string> = {
    received: 'Active',
    pending: 'Inactive',
    unfulfilled: 'Suspended',
  };

  return (
    <AdminLayout>
      <BackNavigation title={retailer.storeName} onBack={() => navigate("/admin/retailers")} />

      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="card-neesh">
              <div className="flex items-start gap-4 mb-4">
                <img 
                  src={retailer.logo} 
                  alt={retailer.storeName}
                  className="w-16 h-16 rounded-lg bg-secondary object-cover"
                />
                <div className="flex-1">
                  <h2 className="font-display font-bold text-heading text-foreground">{retailer.storeName}</h2>
                  <p className="text-body text-muted-foreground">{retailer.contactPerson}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {retailer.storeType.map((type) => (
                      <span key={type} className="px-2 py-0.5 bg-secondary rounded text-caption">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-body text-foreground mb-4">{retailer.description}</p>

              <div className="space-y-2">
                <a href={retailer.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-body text-accent hover:underline">
                  <Globe className="w-4 h-4" />
                  {retailer.website}
                </a>
                <a href={`mailto:${retailer.email}`} className="flex items-center gap-2 text-body text-foreground hover:text-accent">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {retailer.email}
                </a>
                <div className="flex items-center gap-2 text-body text-foreground">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {retailer.phone}
                </div>
                <div className="flex items-center gap-2 text-body text-foreground">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {retailer.address}
                </div>
              </div>
            </div>

            {/* Account Status */}
            <InfoCard title="Account Status">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Status</span>
                  <StatusBadge status={retailer.status} label={statusLabels[retailer.status]} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Member Since</span>
                  <span className="text-body text-foreground">{retailer.memberSince}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Last Order</span>
                  <span className="text-body text-foreground">{retailer.lastOrderDate}</span>
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
            {/* Order History Stats */}
            <InfoCard title="Order History">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-caption text-muted-foreground">Total Orders</p>
                  <p className="font-display font-bold text-display-sm text-foreground">{retailer.totalOrders}</p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Total Spent</p>
                  <p className="font-display font-bold text-display-sm text-foreground">${retailer.totalSpent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Avg Order Value</p>
                  <p className="font-display font-bold text-display-sm text-foreground">${retailer.avgOrderValue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Favorite Publishers</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {retailer.favoritePublishers.slice(0, 2).map((pub) => (
                      <span key={pub} className="px-2 py-0.5 bg-accent/10 text-accent rounded text-caption">
                        {pub}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </InfoCard>

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
                <ButtonSecondary className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </ButtonSecondary>
                <ButtonSecondary onClick={() => navigate("/admin/orders")} className="col-span-2 gap-2">
                  View Full Order History
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
        title="Suspend Retailer"
        message={`Are you sure you want to suspend ${retailer.storeName}? They will no longer be able to place orders or access their account.`}
        confirmLabel="Suspend"
        confirmVariant="destructive"
      />
    </AdminLayout>
  );
};

export default AdminRetailerDetail;
